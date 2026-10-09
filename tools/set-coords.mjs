#!/usr/bin/env node
// ranking JSON の指定した行に x/y を足す。新規加入メンバーを「未配置プール」ではなく
// 実座標に作りたいときに使う（apply-ranking は座標があれば placed=1 で作る）。
//
//   node tools\set-coords.mjs --ranking in.json --coords coords.json --out out.json
//   coords.json は { "名前": [x, y], ... }
//
// 名前の突き合わせは緩いキー（装飾・全半角・同盟タグ・末尾レベルを無視）で行う。
// 当たらなかった名前は最後に出す（★黙って落とすと配置されないまま作られる）。

import fs from "node:fs";
import { looseKey, cleanName, stripTag } from "./lib-norm.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));

const inPath = arg("--ranking"), coordPath = arg("--coords"), outPath = arg("--out");
if (!inPath || !coordPath || !outPath) { console.error("usage: node set-coords.mjs --ranking <in> --coords <coords> --out <out>"); process.exitCode = 2; }
else {
  const key = (n) => looseKey(stripTag(cleanName(String(n ?? ""))));
  const ranking = readJson(inPath);
  const coords = readJson(coordPath);
  const byKey = new Map(Object.entries(coords).map(([n, xy]) => [key(n), xy]));
  const used = new Set();
  const out = ranking.map((r) => {
    const k = key(r.name);
    const xy = byKey.get(k);
    if (!xy) return r;
    used.add(k);
    return { ...r, x: xy[0], y: xy[1] };
  });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  const missed = [...byKey.keys()].filter((k) => !used.has(k));
  console.log(`座標を付けた ${used.size}件 / 指定 ${byKey.size}件 → ${outPath}`);
  for (const m of missed) console.log(`  ★ 名前が当たりませんでした: ${m}`);
  if (missed.length) process.exitCode = 1;
}
