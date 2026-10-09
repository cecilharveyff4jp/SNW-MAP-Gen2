#!/usr/bin/env node
// 複数回の巡回ぶんの profiles をゲームIDで突き合わせて1つにまとめる。
//
//   node tools\merge-runs.mjs --out tools\profiles-all.json a.json b.json c.json
//
// なぜ要るか:
//   1回の巡回では毎回数人落ちる（ポップアップが出ない / 重複判定の誤り）。
//   ゲームIDは不変なので、何回ぶんでも安全に合流できる。後の巡回の値を優先する
//   （同じ人が複数回取れていれば、より新しい読みを残す）。

import fs from "node:fs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const outPath = arg("--out");
const files = process.argv.slice(2).filter((a) => /\.json$/i.test(a) && a !== outPath);
if (!outPath || !files.length) { console.error("usage: node merge-runs.mjs --out <out.json> <in1.json> <in2.json> ..."); process.exit(2); }

const gid = (v) => String(v ?? "").replace(/[^0-9]/g, "");
const byId = new Map();
for (const f of files) {
  const rows = JSON.parse(fs.readFileSync(f, "utf8").replace(/^﻿/, ""));
  let added = 0;
  for (const r of rows) { const g = gid(r.gameId); if (!g) continue; if (!byId.has(g)) added++; byId.set(g, r); }
  console.log(`  ${f}  ${rows.length}件 (新規 ${added})`);
}
const all = [...byId.values()];
fs.writeFileSync(outPath, JSON.stringify(all, null, 2).replace(/\n      /g, " ").replace(/\n    \}/g, " }") + "\n", "utf8");
console.log(`\n合流: ${all.length}人 → ${outPath}`);
