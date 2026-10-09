#!/usr/bin/env node
// 領主ファイル(id_*.png)から「名前・ID・総力・炉レベル」の情報パネルだけを切り出し、
// 重複を除いて数枚のシートにまとめる。
//
//   node tools\crop-ids.mjs --in tools\ids-full --out tools\ids-full\sheets
//
// なぜ要るか:
//   capture-ids は重複前提で撮る（1画面9行×5行送りなので同じ人が2回撮れる）。68人に対し122枚あった。
//   全部そのままチャットに読ませるのは無駄が大きいので、
//     ①情報パネル（画面下部）だけに切る  ②同じ人の重複を落とす  ③タイル状に並べる
//   の3段で読む枚数を1/10以下にする。
//
// 重複判定: 「名前＋ID」の行だけを 96x24 のグレースケールに縮小し、平均輝度で2値化したハッシュ。
//   ★2026-08-20 修正: 以前は切り出し領域全体(総力/撃破数まで)を 32x16 で潰していたため解像度が足りず、
//     **別人が同一ハッシュになって消えていた**（170枚→78枚。id_038 誤字キングXENO が id_024 流浪のむらびと
//     と完全一致して落ち、改名を1件見逃した）。判定はIDの数字が効く帯に絞り、格子を細かくする。
//   下部パネルは半透明で背景キャラが透けるため、同じ人でもハッシュが割れて数枚ダブることがある。
//   ダブりは読む枚数が少し増えるだけだが、別人の取りこぼしは検出できない。**必ず過剰分割側に倒す。**

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

function arg(n, d) { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; }

const inDir = arg("--in", "tools/ids-full");
const outDir = arg("--out", path.join(inDir, "sheets"));
const perSheet = Number(arg("--per-sheet", "14"));
const cols = Number(arg("--cols", "2"));

// 切り出し範囲（実測 720x1612 / A403SH）。名前・ID・総力+炉バッジ・撃破数 まで入れる。
// 自分の領主ファイルは Lv.NN 表記、他人は紫バッジ数字。どちらもこの帯に収まる。
const X0 = Number(arg("--x0", "0.34")), X1 = Number(arg("--x1", "0.99"));
const Y0 = Number(arg("--y0", "0.745")), Y1 = Number(arg("--y1", "0.875"));

// 重複判定に使う帯（切り出し範囲とは別）。名前の行とID行だけ。総力や撃破数は日々変わるので入れない。
const HX0 = Number(arg("--hx0", "0.36")), HX1 = Number(arg("--hx1", "0.99"));
const HY0 = Number(arg("--hy0", "0.778")), HY1 = Number(arg("--hy1", "0.842"));
const HGW = Number(arg("--hgw", "96")), HGH = Number(arg("--hgh", "24"));

const files = fs.readdirSync(inDir).filter((f) => /^id_\d+\.png$/i.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
if (!files.length) { console.error(`${inDir} に id_*.png がありません。`); process.exit(1); }

function cropOf(p) {
  const x0 = Math.round(X0 * p.width), x1 = Math.round(X1 * p.width);
  const y0 = Math.round(Y0 * p.height), y1 = Math.round(Y1 * p.height);
  const w = x1 - x0, h = y1 - y0;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const si = ((y + y0) * p.width + (x + x0)) * 4, di = (y * w + x) * 4;
      out.data[di] = p.data[si]; out.data[di + 1] = p.data[si + 1]; out.data[di + 2] = p.data[si + 2]; out.data[di + 3] = 255;
    }
  return out;
}

// 名前+ID行を HGWxHGH に縮約 → 平均輝度で2値化 → 文字列化。同じ人なら一致する。
// ★元画像から直接取る（切り出し画像を潰すのではなく）。IDの数字が別々の格子に載る細かさが要る。
function hashOf(p) {
  const x0 = Math.round(HX0 * p.width), x1 = Math.round(HX1 * p.width);
  const y0 = Math.round(HY0 * p.height), y1 = Math.round(HY1 * p.height);
  const w = x1 - x0, h = y1 - y0, cell = [];
  for (let gy = 0; gy < HGH; gy++) for (let gx = 0; gx < HGW; gx++) {
    const xs = x0 + Math.floor(gx * w / HGW), xe = x0 + Math.floor((gx + 1) * w / HGW);
    const ys = y0 + Math.floor(gy * h / HGH), ye = y0 + Math.floor((gy + 1) * h / HGH);
    let s = 0, n = 0;
    for (let y = ys; y < ye; y++) for (let x = xs; x < xe; x++) { const i = (y * p.width + x) * 4; s += (p.data[i] + p.data[i + 1] + p.data[i + 2]) / 3; n++; }
    cell.push(s / Math.max(1, n));
  }
  const avg = cell.reduce((a, b) => a + b, 0) / cell.length;
  return cell.map((v) => (v >= avg ? "1" : "0")).join("");
}

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (/^sheet_\d+\.png$/i.test(f)) fs.rmSync(path.join(outDir, f));

// ★--no-dedupe: 重複判定を一切しない。
//   GP版(capture-ids-gp.ps1)は撮影時に名前の帯で重複を落としているので、ここで再度ハッシュを
//   かける必要がない。むしろこのハッシュは **別人を同一と見て捨てたことがある**（冒頭の注記）ので、
//   撮影側で落とし済みなら通さないほうが安全。
const noDedupe = process.argv.includes("--no-dedupe");
const seen = new Map();   // hash -> 代表ファイル名
const uniq = [];
for (const f of files) {
  const p = PNG.sync.read(fs.readFileSync(path.join(inDir, f)));
  if (!noDedupe) {
    const h = hashOf(p);
    if (seen.has(h)) continue;
    seen.set(h, f);
  }
  uniq.push({ file: f, img: cropOf(p) });
}
console.log(noDedupe
  ? `${files.length}枚（重複判定なし）`
  : `${files.length}枚 → 重複を除いて ${uniq.length}枚`);

const cw = uniq[0].img.width, ch = uniq[0].img.height;
const rows = Math.ceil(perSheet / cols);
const sheets = Math.ceil(uniq.length / perSheet);
const index = [];

for (let s = 0; s < sheets; s++) {
  const items = uniq.slice(s * perSheet, (s + 1) * perSheet);
  const sheet = new PNG({ width: cw * cols, height: ch * rows });
  sheet.data.fill(24);
  items.forEach((it, k) => {
    const cx = (k % cols) * cw, cy = Math.floor(k / cols) * ch;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const si = (y * cw + x) * 4, di = ((y + cy) * sheet.width + (x + cx)) * 4;
      sheet.data[di] = it.img.data[si]; sheet.data[di + 1] = it.img.data[si + 1];
      sheet.data[di + 2] = it.img.data[si + 2]; sheet.data[di + 3] = 255;
    }
    index.push({ sheet: s + 1, pos: k + 1, row: Math.floor(k / cols) + 1, col: (k % cols) + 1, file: it.file });
  });
  const out = path.join(outDir, `sheet_${String(s + 1).padStart(2, "0")}.png`);
  fs.writeFileSync(out, PNG.sync.write(sheet));
  console.log(`  ${out}  ${items.length}件 (${cols}列×${rows}行, 1件 ${cw}x${ch})`);
}
fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index, null, 2));
console.log(`\n並び順は左→右、上→下。対応表: ${path.join(outDir, "index.json")}`);
