#!/usr/bin/env node
// 同盟ランキング画面とポップアップの実測値を出す（capture-ids-gp.ps1 の係数決めに使う下見）。
//   node tools\probe-layout.mjs --rank tools\shots\poke\03_back.png --popup tools\shots\poke\01_row1.png

import fs from "node:fs";
import { PNG } from "pngjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const read = (p) => PNG.sync.read(fs.readFileSync(p));
const px = (img, x, y) => { const i = (y * img.width + x) << 2; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };

// --- 行の幾何: 行は明るい角丸、間は濃い青。中央列の明るさで谷/山を数える
function rowProfile(img) {
  // 名前の右端と総力の左端にはさまれた「地の色だけ」の帯を平均する。
  // 1列だけ見ると文字や装飾に当たって暴れるので幅を持たせる。
  const xa = Math.round(img.width * 0.60), xb = Math.round(img.width * 0.655);
  const out = [];
  for (let y = 0; y < img.height; y++) {
    let s = 0, n = 0;
    for (let x = xa; x < xb; x++) { const [r, g, b] = px(img, x, y); s += (r + g + b) / 3; n++; }
    out.push(s / n);
  }
  return out;
}

const rankPath = arg("--rank");
if (rankPath) {
  const img = read(rankPath);
  const prof = rowProfile(img);
  const thr = 150;
  const bands = [];
  let s = null;
  for (let y = 0; y < prof.length; y++) {
    const on = prof[y] > thr;
    if (on && s == null) s = y;
    if (!on && s != null) { if (y - s > 40) bands.push([s, y - 1]); s = null; }
  }
  if (s != null && prof.length - s > 40) bands.push([s, prof.length - 1]);
  console.log(`=== ${rankPath} ${img.width}x${img.height} 行の帯（明るい帯） ===`);
  for (const [a, b] of bands) {
    const c = (a + b) / 2;
    console.log(`  y ${a}..${b}  高さ${b - a + 1}  中心${c}  中心割合 ${(c / img.height).toFixed(4)}`);
  }
  const cs = bands.map(([a, b]) => (a + b) / 2);
  for (let i = 1; i < cs.length; i++) console.log(`  間隔 ${(cs[i] - cs[i - 1]).toFixed(1)}px = ${((cs[i] - cs[i - 1]) / img.height).toFixed(4)}`);
}

// --- ポップアップ: ほぼ白の画素の塊
const popPath = arg("--popup");
if (popPath) {
  const img = read(popPath);
  const W = img.width, H = img.height;
  // ポップアップの地は純白。淡い水色の行(おおむね 205,230,250)と混ざらないよう、
  // 明るさだけでなく「色が付いていないこと」(max-min が小さい)も条件にする。
  const isWhite = (x, y) => {
    const [r, g, b] = px(img, x, y);
    return r > 244 && g > 244 && b > 244 && Math.max(r, g, b) - Math.min(r, g, b) < 10;
  };
  // ★行ごとの白画素数では箱を切り出せない。ボタンの段は白がほとんど残らないので
  //   箱が段ごとにぶつ切りになる（実測: 240px の箱が 19px になった）。
  //   箱の地は margin でひとつながりなので、白画素の**連結成分のうち最大のもの**を取る。
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isWhite(x, y)) mask[y * W + x] = 1;
  const seen = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  let bestArea = 0, box = null;
  for (let start = 0; start < W * H; start++) {
    if (!mask[start] || seen[start]) continue;
    let sp = 0; stack[sp++] = start; seen[start] = 1;
    let area = 0, ax0 = W, ax1 = -1, ay0 = H, ay1 = -1;
    while (sp > 0) {
      const cur = stack[--sp];
      const cy = (cur / W) | 0, cx = cur - cy * W;
      area++;
      if (cx < ax0) ax0 = cx; if (cx > ax1) ax1 = cx;
      if (cy < ay0) ay0 = cy; if (cy > ay1) ay1 = cy;
      if (cx > 0 && mask[cur - 1] && !seen[cur - 1]) { seen[cur - 1] = 1; stack[sp++] = cur - 1; }
      if (cx < W - 1 && mask[cur + 1] && !seen[cur + 1]) { seen[cur + 1] = 1; stack[sp++] = cur + 1; }
      if (cy > 0 && mask[cur - W] && !seen[cur - W]) { seen[cur - W] = 1; stack[sp++] = cur - W; }
      if (cy < H - 1 && mask[cur + W] && !seen[cur + W]) { seen[cur + W] = 1; stack[sp++] = cur + W; }
    }
    if (area > bestArea) { bestArea = area; box = [ax0, ay0, ax1, ay1]; }
  }
  if (!box) { console.log(`\n=== ${popPath} 白の塊なし ===`); process.exit(0); }
  const [x0, y0, x1, y1] = box;
  console.log(`\n=== ${popPath} ${W}x${H} 白の塊（=ポップアップ） ===`);
  console.log(`  x ${x0}..${x1} (w=${x1 - x0 + 1})  y ${y0}..${y1} (h=${y1 - y0 + 1})`);
  console.log(`  割合 x ${(x0 / W).toFixed(4)}..${(x1 / W).toFixed(4)}  y ${(y0 / H).toFixed(4)}..${(y1 / H).toFixed(4)}`);
  // 箱の中の青いボタンを探す（青= B が R より明らかに大きい）
  const isBlue = (x, y) => { const [r, g, b] = px(img, x, y); return b > 150 && b - r > 50 && g > 90; };
  const brow = [];
  for (let y = y0; y <= y1; y++) { let c = 0; for (let x = x0; x <= x1; x++) if (isBlue(x, y)) c++; brow.push([y, c]); }
  const bands = [];
  let s = null;
  for (const [y, c] of brow) {
    const on = c > 40;
    if (on && s == null) s = y;
    if (!on && s != null) { if (y - s > 10) bands.push([s, y - 1]); s = null; }
  }
  if (s != null) bands.push([s, y1]);
  console.log(`  ボタンの行帯:`);
  for (const [a, b] of bands) console.log(`    y ${a}..${b}  中心${((a + b) / 2).toFixed(1)}  箱内割合 ${(((a + b) / 2 - y0) / (y1 - y0)).toFixed(4)}`);
  // 1段目の青い帯で、左端のボタンの x 範囲
  if (bands.length) {
    const [a, b] = bands[0];
    const my = Math.round((a + b) / 2);
    const runs = [];
    let rs = null;
    for (let x = x0; x <= x1; x++) {
      const on = isBlue(x, my);
      if (on && rs == null) rs = x;
      if (!on && rs != null) { if (x - rs > 20) runs.push([rs, x - 1]); rs = null; }
    }
    if (rs != null) runs.push([rs, x1]);
    console.log(`  1段目のボタン x 範囲: ${runs.map(([p, q]) => `${p}..${q}(中心${((p + q) / 2).toFixed(0)}, 箱内${(((p + q) / 2 - x0) / (x1 - x0)).toFixed(4)})`).join("  ")}`);
  }
}
