#!/usr/bin/env node
// 2枚のランキング画面が「縦に何画素ずれたか」を測る。スクロールの送り量を実測するための道具。
//
//   node tools\measure-shift.mjs --a before.png --b after.png [--row 105.5]
//
// 考え方:
//   リスト部分（見出しと最下部の固定行を除く）を縦にずらしながら重ね、いちばん合う位置を探す。
//   アバターは常時アニメーションしているので、名前と総力の文字がある帯だけを見る。
//   ★目視で順位を読むより速くて正確。1px 単位で出るので「1ノッチ＝何行」がはっきりする。

import fs from "node:fs";
import { PNG } from "pngjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const read = (p) => PNG.sync.read(fs.readFileSync(p));

const A = read(arg("--a")), B = read(arg("--b"));
if (A.width !== B.width || A.height !== B.height) { console.error("大きさが違います。"); process.exit(1); }
const W = A.width, H = A.height;
const rowPx = Number(arg("--row", "105.5"));   // 1行の高さ（実測 561x989 で 105.5px）
const maxShift = Number(arg("--max", "700"));

// 見る範囲: 名前〜総力の帯だけ（アバターを避ける）。縦は見出しの下〜固定行の上。
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
const ga = gray(A), gb = gray(B);

// B を dy だけ下にずらすと A に合う、という dy を探す（dy>0 = リストが上に進んだ＝先へ送られた）
let best = null;
for (let dy = -maxShift; dy <= maxShift; dy++) {
  let s = 0, n = 0;
  for (let y = y0; y < y1; y += 2) {
    const ay = y, by = y - dy;
    if (by < y0 || by >= y1) continue;
    for (let x = x0; x < x1; x += 2) {
      const d = ga[ay * W + x] - gb[by * W + x];
      s += d * d; n++;
    }
  }
  if (n < (y1 - y0) * (x1 - x0) / 16) continue;   // 重なりが少なすぎる位置は信用しない
  const rms = Math.sqrt(s / n);
  if (!best || rms < best.rms) best = { dy, rms, n };
}

if (!best) { console.log("測れませんでした。"); process.exit(1); }
console.log(`ずれ ${best.dy}px  (残差 RMS ${best.rms.toFixed(2)} / 比較画素 ${best.n})`);
console.log(`1行=${rowPx}px として ${(best.dy / rowPx).toFixed(3)} 行ぶん`);
