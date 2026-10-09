#!/usr/bin/env node
// gp-wheel-test.ps1 が置いた w_00.png, w_01.png … の連番について、
// 直前との差（1回ぶんの送り量）と、先頭からの累積を一気に測る。
//
//   node tools\measure-series.mjs --dir tools\shots\wheel3 [--row 105.5]

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const dir = arg("--dir");
const rowPx = Number(arg("--row", "105.5"));
const maxShift = Number(arg("--max", "900"));

const files = fs.readdirSync(dir).filter((f) => /^w_\d+\.png$/i.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
if (files.length < 2) { console.error("w_*.png が足りません。"); process.exit(1); }

const read = (f) => PNG.sync.read(fs.readFileSync(path.join(dir, f)));
const first = read(files[0]);
const W = first.width, H = first.height;
const x0 = Math.round(W * 0.33), x1 = Math.round(W * 0.98);
const y0 = Math.round(H * 0.18), y1 = Math.round(H * 0.87);

const gray = (img) => {
  const g = new Float64Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) << 2;
      g[y * W + x] = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
    }
  return g;
};

// ★候補ごとに比較画素数を変えないこと（capture-ids-gp.ps1 の ★11 と同じ話）。
//   「重なった部分だけ比べる」方式だと、大きく送ったとき重なりが減るぶん不利になり、
//   **重なりが最大の dy=0（不正解）が勝つ**。リストは行が周期的なので dy=0 でもそこそこ合う。
//   新しい画面から固定高さの短冊を切り、古い画面の上を滑らせて探す。
const TY0 = Math.round(H * 0.20), TH = Math.round(H * 0.22);
const LIMIT = Math.round(H * 0.87) - TY0 - TH;   // 測れる上限（これを超える送り量は測れない）

function shift(ga, gb) {
  let best = null;
  const hi = Math.min(maxShift, LIMIT);
  for (let dy = -40; dy <= hi; dy++) {
    if (TY0 + dy < Math.round(H * 0.18)) continue;
    let s = 0, n = 0;
    for (let y = TY0; y < TY0 + TH; y += 2)
      for (let x = x0; x < x1; x += 2) { const d = ga[(y + dy) * W + x] - gb[y * W + x]; s += d * d; n++; }
    const rms = Math.sqrt(s / n);
    if (!best || rms < best.rms) best = { dy, rms };
  }
  return best;
}

const grays = files.map((f) => gray(read(f)));
console.log(`${files.length}枚  1行=${rowPx}px`);
console.log("回  直前との差       累積（先頭から）");
let prevCum = 0;
for (let i = 1; i < files.length; i++) {
  const step = shift(grays[i - 1], grays[i]);
  const cum = shift(grays[0], grays[i]);
  const mark = cum.rms > 40 ? "  ※残差大(重なり少)" : "";
  console.log(
    `${String(i).padStart(2)}  ${String(step.dy).padStart(5)}px (${(step.dy / rowPx).toFixed(2)}行)  ` +
    `${String(cum.dy).padStart(5)}px (${(cum.dy / rowPx).toFixed(2)}行)  RMS ${cum.rms.toFixed(1)}${mark}`
  );
  prevCum = cum.dy;
}
