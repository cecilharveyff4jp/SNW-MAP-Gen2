#!/usr/bin/env node
// 撮ったカード画像から「名前・X/Y・戦闘力」が載っている部分だけを切り出し、数枚ずつ縦に束ねた
// 一覧画像を作る。全画面のまま読むより情報密度が高く、読み取りの手間と精度が上がる。
//   使い方: node tools\crop-cards.mjs --in tools\cards\cap --out tools\cards\sheets [--per 8]
// 出力: sheet_01.png ... と、どの行がどのファイルかの対応表（標準出力）。

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

function arg(n, d) { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; }
const inDir = arg("--in", "tools/cards/cap");
const outDir = arg("--out", "tools/cards/sheets");
const PER = Number(arg("--per", "8"));

// capture-cards.mjs と同じ検知でカード位置を求める（左上の杖アイコン (13,194,216) が基準・スキン非依存）
const WAND = [13, 194, 216], WTOL = 22, WAND_MINRUN = 16, STEP = 2, CARD_W = 415;
const isWand = (r, g, b) => Math.abs(r - WAND[0]) <= WTOL && Math.abs(g - WAND[1]) <= WTOL && Math.abs(b - WAND[2]) <= WTOL;
function cardBox(png) {
  const { width, height, data } = png;
  let best = 0, cs = -1, bx = -1, by = -1, cx = 0;
  for (let y = Math.round(height * 0.08); y < Math.round(height * 0.95); y++) {
    const row = y * width * 4;
    let run = 0, bestRun = 0, start = -1, bestStart = -1;
    for (let x = 0; x < width; x += STEP) {
      const i = row + x * 4;
      if (isWand(data[i], data[i + 1], data[i + 2])) { if (start < 0) start = x; run += STEP; if (run > bestRun) { bestRun = run; bestStart = start; } }
      else { run = 0; start = -1; }
    }
    if (bestRun >= WAND_MINRUN) { if (cs < 0) { cs = y; cx = bestStart; } const h = y - cs + 1; if (h > best) { best = h; by = cs; bx = cx; } }
    else cs = -1;
  }
  if (best < 10) return null;
  const x0 = Math.max(0, bx - 24);
  return { x0, x1: Math.min(width - 1, x0 + CARD_W), y0: Math.max(0, by - 14), y1: Math.min(height - 1, by + 300) };
}

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (/^sheet_\d+\.png$/i.test(f)) fs.rmSync(path.join(outDir, f));

// --from / --to で連番の範囲を絞れる（前回分を除いて今回撮った分だけ束ねたい場合に使う）
const FROM = Number(arg("--from", "0")), TO = Number(arg("--to", "999999"));
const files = fs.readdirSync(inDir).filter((f) => /^card_\d+\.png$/i.test(f))
  .map((f) => ({ f, n: Number(/(\d+)/.exec(f)[1]) }))
  .filter((x) => x.n >= FROM && x.n <= TO)
  .sort((a, b) => a.n - b.n).map((x) => x.f);

const crops = [];
for (const f of files) {
  const png = PNG.sync.read(fs.readFileSync(path.join(inDir, f)));
  const b = cardBox(png);
  if (!b) { console.log(`  skip ${f}（カードを検出できず）`); continue; }
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) png.data.copy(out.data, y * w * 4, ((b.y0 + y) * png.width + b.x0) * 4, ((b.y0 + y) * png.width + b.x0 + w) * 4);
  crops.push({ file: f, png: out });
}

const SEP = 6;   // 区切りの黒帯
let sheet = 0;
for (let i = 0; i < crops.length; i += PER) {
  const group = crops.slice(i, i + PER);
  const W = Math.max(...group.map((g) => g.png.width));
  const H = group.reduce((s, g) => s + g.png.height + SEP, 0);
  const out = new PNG({ width: W, height: H });
  out.data.fill(0);
  let y0 = 0;
  for (const g of group) {
    for (let y = 0; y < g.png.height; y++) g.png.data.copy(out.data, ((y0 + y) * W) * 4, y * g.png.width * 4, (y + 1) * g.png.width * 4);
    y0 += g.png.height + SEP;
  }
  sheet++;
  const name = `sheet_${String(sheet).padStart(2, "0")}.png`;
  fs.writeFileSync(path.join(outDir, name), PNG.sync.write(out));
  console.log(`${name}  ${W}x${H}  上から順に: ${group.map((g) => g.file.replace(/^card_|\.png$/g, "")).join(", ")}`);
}
console.log(`\n${crops.length}枚を${sheet}シートに集約 → ${path.resolve(outDir)}`);
