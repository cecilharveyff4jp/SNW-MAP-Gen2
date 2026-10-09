#!/usr/bin/env node
// 領主ファイルの profiles と DB の objects を突き合わせ、
//   ① 改名（ゲームIDが一致していて名前が違う）
//   ② 新規加入（DBに無いゲームID）
//   ③ 今回のランキングに居ないDBメンバー（脱退の候補）
// の3つに仕分ける。ゲームIDは不変なので、ここは推測ではなく確定になる。
//
//   node tools\classify-members.mjs --profiles tools\profiles-20261008.json [--map 1]
//
// ★③は「消してよい」という意味ではない。同盟を抜けてもマップ上の都市は残す方針。

import fs from "node:fs";
import { d1query } from "./snw-d1.mjs";
import { primaryKey } from "./lib-norm.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));
const gid = (v) => String(v ?? "").replace(/[^0-9]/g, "");
const rows = (r) => r.result?.[0]?.results ?? r.results ?? [];

const profPath = arg("--profiles");
if (!profPath) { console.error("usage: node classify-members.mjs --profiles <file> [--map 1]"); process.exit(2); }
const mapId = Number(arg("--map", "1"));

const profiles = readJson(profPath);
const db = rows(await d1query(
  `SELECT id, map_id, type, label, game_id, fc_level, power, placed FROM objects WHERE map_id = ${mapId}`
));

const byId = new Map();
for (const o of db) { const g = gid(o.game_id); if (g && !byId.has(g)) byId.set(g, o); }

const renamed = [], same = [], fresh = [], fcChanged = [];
for (const p of profiles) {
  const o = byId.get(gid(p.gameId));
  if (!o) { fresh.push(p); continue; }
  // ★生の文字列で比べてはいけない。DB の label は保存時に半角化(toHalf)されているので、
  //   `ﾋﾞﾝﾁｮｳﾏｸﾞﾛ`(DB) と `ビンチョウマグロ`(ゲーム画面) が別名に見えてしまう。
  //   実測 2026-10-08: これで 31件が改名扱いになったが、本当の改名は 11件だけだった。
  if (primaryKey(o.label ?? "") !== primaryKey(p.name)) renamed.push({ o, p });
  else same.push({ o, p });
  if (String(o.fc_level ?? "") !== String(p.fcLevel ?? "")) fcChanged.push({ o, p });
}
const seen = new Set(profiles.map((p) => gid(p.gameId)));
const left = db.filter((o) => gid(o.game_id) && !seen.has(gid(o.game_id)));

console.log(`領主ファイル ${profiles.length}件 / DB(map${mapId}) ${db.length}件`);

console.log(`\n=== ① 改名（ゲームID一致・名前が違う） ${renamed.length}件 ===`);
for (const { o, p } of renamed) console.log(`  id=${o.id}  ${o.label}  →  ${p.name}    (${p.gameId})`);

console.log(`\n=== ② DBに無いゲームID = 新規加入 ${fresh.length}件 ===`);
for (const p of fresh) console.log(`  ${p.name}  ${p.gameId}  ${p.fcLevel}`);

console.log(`\n=== ③ 今回のランキングに居ないDBメンバー ${left.length}件（★都市は消さない） ===`);
for (const o of left) console.log(`  id=${o.id}  ${o.label}  ${o.game_id}  power=${o.power ?? "-"}  type=${o.type}`);

console.log(`\n=== FIREレベルが変わった ${fcChanged.length}件 ===`);
for (const { o, p } of fcChanged) console.log(`  ${p.name}  ${o.fc_level ?? "(未設定)"} → ${p.fcLevel}`);

console.log(`\n名前もFCも一致 ${same.length - fcChanged.filter((c) => !renamed.some((r) => r.p === c.p)).length}件（参考: 名前一致 ${same.length}件）`);
