#!/usr/bin/env node
// 総力ランキングのスクショ(rank_*.png)から「1行ぶんの帯」を切り出し、読むのに要らない部分を捨てて
// タイル状のシートにまとめる。チャットに読ませる画像の量を減らすためのツール。
//
//   node tools\crop-rank.mjs --in tools\shots\rank-20260728
//
// なぜ要るか（実測）:
//   撮影35秒・照合0.6秒・D1書き込み数秒に対して、**画像の読み取りだけが突出して重い**。
//   ここで削れるのは「読む画像の面積」だけなので、そこだけを削る。
//   720x1612 のフルスクリーン14枚 ≒ 16.3Mpx → 本ツールで約 5.7Mpx（3分の1）。
//
// 何を捨てるか:
//   ・ヘッダ／タブ／列見出し／最下部の固定行（毎枚同じものが写るだけ）
//   ・行の上下の余白
//   ・**アバター画像**（読み取りに不要なうえ、アニメーションしていて情報量だけ食う）
//   残すのは 順位バッジ ＋ 名前 ＋ 総力 の3つ。
//
// ★重複除去はしない。
//   撮影は取りこぼし防止のため1画面未満ずつスクロールする＝必ず重複するが、
//   画像ハッシュによる重複除去は**実測で失敗した**ので入れていない:
//     ・行全体のハッシュ … アバターがアニメーションするため同じ行でも一致しない（110→105件）
//     ・総力欄のハッシュ … 100件。やはり潰れない
//     ・順位バッジのハッシュ … 110→69件と一見うまくいくが、**別の順位が同じハッシュに潰れて
//       16名が消えた**（1,9,10,14,35,40-43,46,49,50,54,60,66,68位）。silent data loss なので不採用
//     ・ハミング距離での曖昧一致 … 順位バッジ同士が元々似ており、しきい値1で110→37件まで潰れる
//   重複は読むときに飛ばせば済む（順位が各行に書いてあるので一目で分かる）。
//   **取りこぼしの検知は「読み取った順位が1..Nで連続しているか」で行うこと。** 件数では判定できない。

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

function arg(n, d) { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; }

const inDir = arg("--in", "tools/shots/rank-20260728");
const outDir = arg("--out", path.join(inDir, "sheets"));
const perSheet = Number(arg("--per-sheet", "24"));
const cols = Number(arg("--cols", "2"));

// リスト領域（この外は見ない）。上=列見出しの下、下=固定行の上。
// 固定行（自分の順位）は全画面に写るので、入れると毎枚1件ずつ無駄が出る。
const Y0F = Number(arg("--y0", "0.168")), Y1F = Number(arg("--y1", "0.905"));
// 行の高さの許容範囲（実測 約121px = 0.075H）。画面端で切れた行はここで落ちる。
const HMIN = Number(arg("--hmin", "0.070")), HMAX = Number(arg("--hmax", "0.098"));
// 残す2つの窓。あいだのアバター(約0.16〜0.32W)は捨てる。
const BX0 = Number(arg("--badge-x0", "0.030")), BX1 = Number(arg("--badge-x1", "0.155"));
const TX0 = Number(arg("--text-x0", "0.330")),  TX1 = Number(arg("--text-x1", "0.985"));
// 行の上下の余白を落とす割合。
const PAD = Number(arg("--pad", "0.10"));

const files = fs.readdirSync(inDir).filter((f) => /^rank_\d+\.png$/i.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
if (!files.length) { console.error(`${inDir} に rank_*.png がありません。`); process.exit(1); }

// 明るい帯（行）の y 範囲を返す。行間の隙間は濃紺なので、走査線の平均輝度で切れる。
//
// ★輝度の計算に**アバターを含めてはいけない**。
//   1位のアバターが黒い絵だったとき、その走査線だけ行の平均がしきい値を割り、
//   1行(y284-403)が 51px/11px/53px の3つに分断されて全部“高さ不足”で捨てられた＝1位が消えた。
//   名前と総力の帯(x 0.35〜0.98)は常に明るい背景なので、ここだけを見れば分断されない。
// あわせて、数pxの隙間は繋ぐ（1画素でも割れると行が壊れるため）。
// ★この窓は「行の中だけ」に収めること。端が行の外（背景）にはみ出すと、全走査線に暗い画素が
//   混ざって行と隙間のコントラストが落ち、画像によっては1行も検出できなくなる。
//   Google Play Games 版は行の右端が画像の 0.96 付近なので、--px1 で内側に詰める。
const PX0 = Number(arg("--px0", "0.35")), PX1 = Number(arg("--px1", "0.98"));
// ★GAP がこの検出でいちばん敏感な値。行間の隙間より大きいと隣の行と繋がり、繋がった帯は
//   「高すぎる」として捨てられる＝行が丸ごと消える。スマホ版の隙間は広いので 10 でよいが、
//   Google Play Games 版の隙間は 11〜12px しかなく、10 だと画像によって 0〜6 行と暴れる。4 で安定。
const GAP = Number(arg("--gap", "10"));
const TH = Number(arg("--th", "0.45"));
function rowBands(png) {
  const { width: W, height: H, data } = png;
  const x0 = Math.round(PX0 * W), x1 = Math.round(PX1 * W);
  const y0 = Math.round(Y0F * H), y1 = Math.round(Y1F * H);
  const bright = [];
  for (let y = y0; y < y1; y++) {
    let s = 0, n = 0;
    for (let x = x0; x < x1; x += 3) { const i = (y * W + x) * 4; s += (data[i] + data[i + 1] + data[i + 2]) / 3; n++; }
    bright.push(s / n);
  }
  // しきい値は画像ごとに決める（明るい行と濃紺の隙間で二極化しているので中間で切れる）。
  // ★TH を上げすぎてもいけない。1位の行は金色で、名前・総力の帯の輝度が水色の行より低い。
  //   実測(2026-08-07, GooglePlay版): th=0.6 にすると1位の行だけ2つに割れて両方“高さ不足”で
  //   捨てられ、**1位が丸ごと消えた**。0.35〜0.5 ならどれでも同じ結果になる（＝敏感なのは GAP）。
  const lo = Math.min(...bright), hi = Math.max(...bright);
  const th = lo + (hi - lo) * TH;
  let bands = [];
  let start = -1;
  for (let k = 0; k < bright.length; k++) {
    if (bright[k] >= th) { if (start < 0) start = k; }
    else if (start >= 0) { bands.push([start + y0, k + y0]); start = -1; }
  }
  if (start >= 0) bands.push([start + y0, y1]);
  // 細い隙間で割れた帯を繋ぐ
  const merged = [];
  for (const b of bands) {
    const last = merged[merged.length - 1];
    if (last && b[0] - last[1] <= GAP) last[1] = b[1];
    else merged.push([b[0], b[1]]);
  }
  bands = merged;
  const hmin = Math.round(HMIN * H), hmax = Math.round(HMAX * H);
  return bands.filter(([a, b]) => (b - a) >= hmin && (b - a) <= hmax);
}

// 順位バッジと「名前＋総力」を横に並べた1枚を作る（アバターは挟まない）。
function compactStrip(png, a, b) {
  const { width: W, data } = png;
  const pad = Math.round((b - a) * PAD);
  const ya = a + pad, yb = b - pad, h = yb - ya;
  const bx0 = Math.round(BX0 * W), bx1 = Math.round(BX1 * W);
  const tx0 = Math.round(TX0 * W), tx1 = Math.round(TX1 * W);
  const bw = bx1 - bx0, tw = tx1 - tx0;
  const out = new PNG({ width: bw + tw, height: h });
  const blit = (sx0, sw, dx0) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < sw; x++) {
      const si = ((y + ya) * W + (x + sx0)) * 4, di = (y * out.width + (x + dx0)) * 4;
      out.data[di] = data[si]; out.data[di + 1] = data[si + 1]; out.data[di + 2] = data[si + 2]; out.data[di + 3] = 255;
    }
  };
  blit(bx0, bw, 0);
  blit(tx0, tw, bw);
  return out;
}

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (/^sheet_\d+\.png$/i.test(f)) fs.rmSync(path.join(outDir, f));

const strips = [];
let srcPixels = 0;
for (const f of files) {
  const png = PNG.sync.read(fs.readFileSync(path.join(inDir, f)));
  srcPixels += png.width * png.height;
  const bands = rowBands(png);
  for (const [a, b] of bands) strips.push({ file: f, y: a, img: compactStrip(png, a, b) });
  console.log(`  ${f}  ${bands.length}行`);
}
if (!strips.length) { console.error("行を検出できませんでした。--y0/--y1/--hmin/--hmax を確認してください。"); process.exit(1); }

const cw = Math.max(...strips.map((s) => s.img.width));
const ch = Math.max(...strips.map((s) => s.img.height));
const rows = Math.ceil(perSheet / cols);
const sheets = Math.ceil(strips.length / perSheet);
const index = [];
let outPixels = 0;

for (let s = 0; s < sheets; s++) {
  const items = strips.slice(s * perSheet, (s + 1) * perSheet);
  const sheet = new PNG({ width: cw * cols, height: ch * Math.min(rows, Math.ceil(items.length / cols)) });
  sheet.data.fill(20);
  items.forEach((it, k) => {
    const ox = (k % cols) * cw, oy = Math.floor(k / cols) * ch;
    for (let y = 0; y < it.img.height; y++) for (let x = 0; x < it.img.width; x++) {
      const si = (y * it.img.width + x) * 4, di = ((y + oy) * sheet.width + (x + ox)) * 4;
      sheet.data[di] = it.img.data[si]; sheet.data[di + 1] = it.img.data[si + 1];
      sheet.data[di + 2] = it.img.data[si + 2]; sheet.data[di + 3] = 255;
    }
    index.push({ sheet: s + 1, pos: k + 1, src: it.file, y: it.y });
  });
  outPixels += sheet.width * sheet.height;
  const out = path.join(outDir, `sheet_${String(s + 1).padStart(2, "0")}.png`);
  fs.writeFileSync(out, PNG.sync.write(sheet));
  console.log(`${out}  ${items.length}件`);
}
fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index, null, 2));

console.log(`\n行 ${strips.length}件（重複込み）→ シート ${sheets}枚（${cols}列, 1件 ${cw}x${ch}）`);
console.log(`読む面積: ${(srcPixels / 1e6).toFixed(1)}Mpx → ${(outPixels / 1e6).toFixed(1)}Mpx（${Math.round((1 - outPixels / srcPixels) * 100)}%減）`);
console.log(`並び順は左→右、上→下。対応表: ${path.join(outDir, "index.json")}`);
console.log(`★重複は残っています。読んだあと **順位が1..Nで連続しているか** を必ず確認してください（件数では判定できません）。`);
