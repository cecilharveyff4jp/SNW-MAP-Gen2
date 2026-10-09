#!/usr/bin/env node
// 領主ファイルから読んだ profiles JSON が「ランキング全員ぶん揃っているか」を照合する。
//
//   node tools\verify-ids.mjs --profiles tools\profiles-20261008.json --ranking tools\ranking-20261008.json [--self ｾｼﾙ]
//
// なぜ要るか:
//   領主ファイルの巡回は「行を押す→戻る」の繰り返しなので、押し損ね・戻り損ねで**人が丸ごと落ちる**。
//   落ちても枚数では気付けない（重複スキップの数と区別が付かない）。
//   先にランキングを撮って名前の一覧を作ってあるので、**名前で突き合わせれば取りこぼしが確定する**。
//
// ★自分自身はランキングの一番下に固定表示されていて押しても領主ファイルに飛ばないため、
//   原理的に撮れない。--self で名前を渡せば「欠けていて当然」として扱う。
//
// 終了コード: 0=全員ぶん揃っている / 1=欠けあり

import fs from "node:fs";
import { looseKey, cleanName, stripTag } from "./lib-norm.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));

const profPath = arg("--profiles"), rankPath = arg("--ranking");
if (!profPath || !rankPath) { console.error("usage: node verify-ids.mjs --profiles <file> --ranking <file> [--self <name>]"); process.exit(2); }
const selfName = arg("--self", "");

const key = (n) => looseKey(stripTag(cleanName(String(n ?? ""))));

const profiles = readJson(profPath);
const ranking = readJson(rankPath);

const pByKey = new Map();
const dupIds = new Map();
for (const p of profiles) {
  const k = key(p.name);
  if (pByKey.has(k)) console.log(`⚠ 領主ファイルに同じ名前が2件: "${p.name}"`);
  pByKey.set(k, p);
  const g = String(p.gameId ?? "").replace(/[^0-9]/g, "");
  if (g) dupIds.set(g, (dupIds.get(g) ?? 0) + 1);
}
for (const [g, n] of dupIds) if (n > 1) console.log(`⚠ 同じゲームIDが${n}件: ${g}`);

const missing = [], extra = [];
for (const r of ranking) if (!pByKey.has(key(r.name))) missing.push(r);
const rKeys = new Set(ranking.map((r) => key(r.name)));
for (const p of profiles) if (!rKeys.has(key(p.name))) extra.push(p);

console.log(`ランキング ${ranking.length}人 / 領主ファイル ${profiles.length}件`);

const selfKey = selfName ? key(selfName) : null;
const missingReal = missing.filter((m) => key(m.name) !== selfKey);
const missingSelf = missing.filter((m) => key(m.name) === selfKey);

if (missingSelf.length) console.log(`\n（自分自身 "${missingSelf[0].name}" は固定行で押せないため欠けていて正常）`);

if (missingReal.length) {
  console.log(`\n✗ 領主ファイルが取れていない ${missingReal.length}人（★撮り直しが要る）:`);
  for (const m of missingReal) console.log(`   ${String(m.rank ?? "?").padStart(3)}位  ${m.name}`);
} else {
  console.log(`\n✅ ランキングの全員ぶん揃っています（自分自身を除く）`);
}
if (extra.length) {
  console.log(`\n? ランキングに居ない領主ファイル ${extra.length}件（読み違いか、撮影中に順位が動いた）:`);
  for (const e of extra) console.log(`   ${e.name}  ${e.gameId ?? ""}`);
}

const noId = profiles.filter((p) => !String(p.gameId ?? "").replace(/[^0-9]/g, ""));
if (noId.length) console.log(`\n✗ gameId が読めていない ${noId.length}件: ${noId.map((p) => p.name).join(", ")}`);

process.exit(missingReal.length || noId.length ? 1 : 0);
