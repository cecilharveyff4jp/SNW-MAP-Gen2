#!/usr/bin/env node
// 2回ぶんの profiles を突き合わせて、ゲームID・名前・FIREレベルが一致するか調べる。
//
//   node tools\diff-profiles.mjs --a tools\profiles-all-20261008.json --b tools\profiles-wheel.json
//
// 使いどころ: 撮り方（ドラッグ→ホイール等）を変えたときに、**同じ答えが出るか**を確かめる。
// 読み取りの間違いは1回ぶんだけ見ても気付けないが、独立した2回が一致すれば両方とも裏が取れる。

import fs from "node:fs";
import { primaryKey } from "./lib-norm.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));
const gid = (v) => String(v ?? "").replace(/[^0-9]/g, "");

const aPath = arg("--a"), bPath = arg("--b");
if (!aPath || !bPath) { console.error("usage: node diff-profiles.mjs --a <file> --b <file>"); process.exit(2); }

const A = readJson(aPath), B = readJson(bPath);
const mapOf = (rows) => new Map(rows.filter((r) => gid(r.gameId)).map((r) => [gid(r.gameId), r]));
const ma = mapOf(A), mb = mapOf(B);

const onlyA = [...ma.keys()].filter((k) => !mb.has(k));
const onlyB = [...mb.keys()].filter((k) => !ma.has(k));
const both = [...ma.keys()].filter((k) => mb.has(k));

const nameDiff = [], fcDiff = [];
for (const k of both) {
  const a = ma.get(k), b = mb.get(k);
  if (primaryKey(a.name ?? "") !== primaryKey(b.name ?? "")) nameDiff.push({ k, a: a.name, b: b.name });
  if (String(a.fcLevel ?? "") !== String(b.fcLevel ?? "")) fcDiff.push({ k, n: b.name, a: a.fcLevel, b: b.fcLevel });
}

console.log(`A ${ma.size}人 / B ${mb.size}人 / 共通 ${both.length}人`);
if (onlyA.length) { console.log(`\nA だけ ${onlyA.length}件:`); for (const k of onlyA) console.log(`   ${ma.get(k).name}  ${k}`); }
if (onlyB.length) { console.log(`\nB だけ ${onlyB.length}件:`); for (const k of onlyB) console.log(`   ${mb.get(k).name}  ${k}`); }
if (nameDiff.length) { console.log(`\n名前が違う ${nameDiff.length}件:`); for (const d of nameDiff) console.log(`   ${d.k}  "${d.a}" vs "${d.b}"`); }
if (fcDiff.length) { console.log(`\nFIREレベルが違う ${fcDiff.length}件:`); for (const d of fcDiff) console.log(`   ${d.n}  ${d.a} vs ${d.b}`); }
if (!onlyA.length && !onlyB.length && !nameDiff.length && !fcDiff.length) console.log("\n✅ 完全に一致");
else process.exitCode = 1;
