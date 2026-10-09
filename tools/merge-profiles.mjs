#!/usr/bin/env node
// 領主ファイルから読んだ profiles を ranking JSON に合流させ、各行に gameId と fcLevel を足す。
//
//   node tools\merge-profiles.mjs --ranking tools\ranking-20261008.json \
//        --profiles tools\profiles-20261008.json --out tools\ranking-20261008-ids.json
//
// なぜ要るか:
//   ★ゲーム内の改名が多い。名前だけで照合すると、改名した人が「未一致＝新規」に落ちて
//     **同じ人の都市が二重登録される**。ゲームIDは不変なので、ID が付いていれば
//     apply-ranking.mjs が ID 優先で照合して改名追従してくれる（名前は label を更新）。
//
// 突き合わせは名前（装飾・全半角・同盟タグ・末尾レベルを無視した緩いキー）で行う。
// ランキングも領主ファイルも同じ画面から同じ日に取っているので、名前は一致するのが正常。
// 一致しなかった行は gameId 無しのまま残し、最後に一覧で出す（★そのまま流すと二重登録になる）。

import fs from "node:fs";
import { looseKey, cleanName, stripTag } from "./lib-norm.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));

const rankPath = arg("--ranking"), profPath = arg("--profiles"), outPath = arg("--out");
if (!rankPath || !profPath || !outPath) {
  console.error("usage: node merge-profiles.mjs --ranking <file> --profiles <file> --out <file>");
  process.exit(2);
}
const key = (n) => looseKey(stripTag(cleanName(String(n ?? ""))));

const ranking = readJson(rankPath);
const profiles = readJson(profPath);
const byKey = new Map(profiles.map((p) => [key(p.name), p]));

const merged = [];
const noId = [];
for (const r of ranking) {
  const p = byKey.get(key(r.name));
  if (p) merged.push({ ...r, gameId: String(p.gameId), fcLevel: p.fcLevel });
  else { merged.push({ ...r }); noId.push(r); }
}

fs.writeFileSync(outPath, JSON.stringify(merged, null, 2).replace(/\n      /g, " ").replace(/\n    \}/g, " }") + "\n", "utf8");
console.log(`${ranking.length}行 → gameId を付けた ${merged.length - noId.length}行 / 付かなかった ${noId.length}行`);
if (noId.length) {
  console.log(`\n★ gameId が付かなかった行（このまま流すと二重登録になり得ます）:`);
  for (const r of noId) console.log(`   ${String(r.rank ?? "?").padStart(3)}位  ${r.name}`);
}
console.log(`\n→ ${outPath}`);
