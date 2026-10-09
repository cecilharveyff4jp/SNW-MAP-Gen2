#!/usr/bin/env node
// 同盟を抜けた人の都市オブジェクトを type='CITY' → 'OTHER' に変える。
//
//   node tools\retire-members.mjs --ranking tools\ranking-20261008-final.json [--map 1]        # ドライラン
//   node tools\retire-members.mjs --ranking … --apply
//
// なぜ要るか:
//   アプリの「都市」件数＝ type='CITY' の数。脱退者をそのまま CITY で残すと件数が合わず、
//   同盟員リストが実際の人数とずれる。かといって**消してはいけない**（マップ上の履歴として残す方針）。
//   type を OTHER に落とせば、地図には残したまま同盟員の数から外れる。
//   ★DBには既に先例がある（`元祖ぼぶ` が OTHER で残っている）。それに倣う。
//
// 判定: ランキングに居る game_id を「在籍」とみなし、map 上の CITY でそこに居ないものを対象にする。
//   ★ゲームIDで判定すること。名前で判定すると改名した人を脱退と誤認して全員の型を壊す。
//   game_id が空の CITY は判定できないので触らない（出力には出す）。
//
// power は消さない（power_history と突き合わせる手がかりとして残す）。fc_level も残す。

import fs from "node:fs";
import { d1query } from "./snw-d1.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes(n);
const rows = (r) => r.result?.[0]?.results ?? r.results ?? [];
const gid = (v) => String(v ?? "").replace(/[^0-9]/g, "");
const esc = (s) => String(s).replace(/'/g, "''");

const rankPath = arg("--ranking");
const mapId = Number(arg("--map", "1"));
const apply = has("--apply");
const ACTOR = arg("--actor", "scrcpy-auto");

if (!rankPath) { console.error("usage: node retire-members.mjs --ranking <file> [--map 1] [--apply]"); process.exitCode = 2; }
else {
  const ranking = JSON.parse(fs.readFileSync(rankPath, "utf8").replace(/^﻿/, ""));
  const active = new Set(ranking.map((r) => gid(r.gameId)).filter(Boolean));
  if (active.size < ranking.length) {
    console.error(`★ ranking の ${ranking.length - active.size}行に gameId がありません。先に gameId を付けてください（付けないと在籍者を脱退扱いにします）。`);
    process.exitCode = 1;
  } else {
    const cities = rows(await d1query(`SELECT id, label, game_id, power, fc_level FROM objects WHERE map_id = ${mapId} AND type = 'CITY'`));
    const noGid = cities.filter((c) => !gid(c.game_id));
    const targets = cities.filter((c) => gid(c.game_id) && !active.has(gid(c.game_id)));

    console.log(`map${mapId} の CITY ${cities.length}件 / ランキング在籍 ${active.size}人`);
    if (noGid.length) {
      console.log(`\n※ game_id が無くて判定できない CITY ${noGid.length}件（触りません）:`);
      for (const c of noGid) console.log(`   id=${c.id}  ${c.label}`);
    }
    console.log(`\n→ OTHER にする ${targets.length}件:`);
    for (const c of targets) console.log(`   id=${c.id}  ${c.label}  ${c.game_id}  power=${c.power ?? "-"}`);
    console.log(`\n適用後の CITY 件数: ${cities.length - targets.length}`);

    if (!targets.length) console.log("\n対象なし。");
    else if (!apply) console.log("\n※ ドライラン。反映は --apply");
    else {
      const stmts = [];
      for (const c of targets) {
        stmts.push(`UPDATE objects SET type = 'OTHER' WHERE id = ${c.id};`);
        const detail = JSON.stringify({ 種別: ["CITY", "OTHER"], 理由: "同盟ランキングに不在（脱退）" });
        stmts.push(`INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail) VALUES ('${esc(ACTOR)}', 'update', 'object', '${c.id}', '${esc(c.label ?? "")}', '${esc(detail)}');`);
      }
      await d1query(stmts.join("\n"));
      console.log(`\n✅ ${targets.length}件を OTHER に変更（audit_log にも記録）`);
    }
  }
}
