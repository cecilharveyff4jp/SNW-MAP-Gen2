#!/usr/bin/env node
// 読み取り結果(ranking JSON)を機械的に検証する。GUI の［実行］を解放してよいかの判定に使う。
//
//   node tools\verify-ranking.mjs --ranking tools\ranking.json [--prev tools\ranking-20260728a.json] [--json]
//
// なぜ要るか:
//   画像の読み取り違いは「件数」では絶対に検知できない（crop-rank.mjs の注記と同じ話）。
//   重複行を名寄せする過程で1人ぶん落ちても、別の重複が残っていれば件数は合ってしまう。
//   代わりに、ランキング画面の性質から必ず成り立つ次の3つを検査する:
//     ① 順位が 1..N で連続している（欠番も重複も無い）… 取りこぼしの検知はこれで行う
//     ② 総力が順位の順に単調減少している            … 桁の読み違い(4→9 等)がここで落ちる
//     ③ 名前が空でない / 名前の重複が無い            … アバターに潰された行の検知
//   さらに前回ぶんを渡せば、前回比の異常（総力が半分以下/2倍以上）を警告として出す。
//
// 終了コード: 0=合格（警告はあり得る） / 1=不合格（実行に進んではいけない） / 2=使い方の誤り

import fs from "node:fs";

function arg(n, d) { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; }
const has = (n) => process.argv.includes(n);

const rankingPath = arg("--ranking");
const prevPath = arg("--prev");
const asJson = has("--json");
// 前回比の許容幅。総力は1日で倍増も半減もしない（資源庫キャラの立ち上げを除く）。
const RISE = Number(arg("--max-rise", "2.0")), FALL = Number(arg("--max-fall", "0.5"));

if (!rankingPath) { console.error("usage: node verify-ranking.mjs --ranking <file> [--prev <file>] [--json]"); process.exit(2); }

// PowerShell 経由で書かれた JSON は BOM 付きになりがち。apply-ranking.mjs と同じ剥がし方をする。
function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, "")); }

let rows;
try { rows = readJson(rankingPath); } catch (e) { console.error(`JSON として読めません: ${e.message}`); process.exit(1); }
if (!Array.isArray(rows)) { console.error("配列ではありません。[{rank,name,power}, ...] の形が必要です。"); process.exit(1); }

const errors = [], warns = [];
const n = rows.length;
if (n === 0) errors.push("0件です。");

// ---- ① 順位が 1..N で連続しているか
const ranks = rows.map((r) => Number(r.rank));
if (ranks.some((r) => !Number.isInteger(r))) {
  errors.push("rank が整数でない行があります。");
} else {
  const seen = new Set(), dup = [], missing = [];
  for (const r of ranks) { if (seen.has(r)) dup.push(r); seen.add(r); }
  for (let k = 1; k <= n; k++) if (!seen.has(k)) missing.push(k);
  if (dup.length) errors.push(`順位が重複: ${dup.join(", ")}`);
  if (missing.length) errors.push(`順位が欠番: ${missing.join(", ")}（★取りこぼし。撮り直しか読み直しが要ります）`);
}

// ---- ② 総力が順位順に単調減少しているか（同値は許容: 同率は起こり得る）
const sorted = [...rows].filter((r) => Number.isInteger(Number(r.rank))).sort((a, b) => a.rank - b.rank);
for (let k = 1; k < sorted.length; k++) {
  const p0 = Number(sorted[k - 1].power), p1 = Number(sorted[k].power);
  if (!Number.isFinite(p0) || !Number.isFinite(p1)) { errors.push(`power が数値でない: 順位${sorted[k].rank} "${sorted[k].name}"`); continue; }
  if (p1 > p0) errors.push(`総力が順位と逆転: ${sorted[k - 1].rank}位 ${p0.toLocaleString()} < ${sorted[k].rank}位 ${p1.toLocaleString()}（読み違いの疑い）`);
}

// ---- ③ 名前
const names = new Map();
for (const r of rows) {
  const nm = String(r.name ?? "").trim();
  if (!nm) { errors.push(`名前が空: 順位${r.rank}（アバターに潰された行の可能性）`); continue; }
  names.set(nm, (names.get(nm) ?? 0) + 1);
}
for (const [nm, c] of names) if (c > 1) warns.push(`同じ名前が${c}件: "${nm}"（同名の別人なら問題なし）`);

// ---- 前回比（警告のみ。人が見て判断する）
if (prevPath && fs.existsSync(prevPath)) {
  let prev = [];
  try { prev = readJson(prevPath); } catch { warns.push(`前回ファイルを読めません: ${prevPath}`); }
  const byName = new Map(prev.map((r) => [String(r.name ?? "").trim(), r]));
  for (const r of rows) {
    const p = byName.get(String(r.name ?? "").trim());
    if (!p || !Number.isFinite(Number(p.power)) || Number(p.power) <= 0) continue;
    const ratio = Number(r.power) / Number(p.power);
    if (ratio > RISE || ratio < FALL) {
      warns.push(`前回比が異常: "${r.name}" ${Number(p.power).toLocaleString()} → ${Number(r.power).toLocaleString()}（${ratio.toFixed(2)}倍）`);
    }
  }
  const gone = prev.filter((p) => !rows.some((r) => String(r.name ?? "").trim() === String(p.name ?? "").trim()));
  if (gone.length) warns.push(`前回いて今回いない: ${gone.map((g) => g.name).join(", ")}（脱退か改名。改名なら未一致として出ます）`);
}

const ok = errors.length === 0;
const result = { ok, count: n, errors, warnings: warns, ranking: rankingPath, prev: prevPath ?? null };

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`${ok ? "✅ 合格" : "❌ 不合格"}  ${n}件  (順位1..${n}連続 / 総力単調減少 / 名前)`);
  for (const e of errors) console.log(`  ❌ ${e}`);
  for (const w of warns) console.log(`  ⚠ ${w}`);
  if (ok && !warns.length) console.log("  問題ありません。ドライランへ進めます。");
}
process.exit(ok ? 0 : 1);
