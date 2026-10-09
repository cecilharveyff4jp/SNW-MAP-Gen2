#!/usr/bin/env node
// 画像の一部を切り出して整数倍に拡大する（チャットに読ませる用の下見ツール）。
// 領主ファイルのように「小さい字を確実に読みたい」ときに使う。最近傍なので字がにじまない。
//
//   node tools\zoom.mjs --in a.png --out b.png --x 0 --y 660 --w 561 --h 240 --scale 2
//   座標は割合でも指定できる: --fx 0 --fy 0.667 --fw 1 --fh 0.243

import fs from "node:fs";
import { PNG } from "pngjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const num = (v) => (v == null ? null : Number(v));

const inPath = arg("--in"), outPath = arg("--out");
if (!inPath || !outPath) { console.error("usage: node zoom.mjs --in a.png --out b.png [--x --y --w --h | --fx --fy --fw --fh] [--scale 2]"); process.exit(2); }

const src = PNG.sync.read(fs.readFileSync(inPath));
const scale = Number(arg("--scale", "2"));

const f = (name, px, frac, total) => {
  const p = num(arg(px)), q = num(arg(frac));
  if (p != null) return Math.round(p);
  if (q != null) return Math.round(q * total);
  return null;
};
let x = f("x", "--x", "--fx", src.width) ?? 0;
let y = f("y", "--y", "--fy", src.height) ?? 0;
let w = f("w", "--w", "--fw", src.width) ?? src.width - x;
let h = f("h", "--h", "--fh", src.height) ?? src.height - y;
x = Math.max(0, Math.min(src.width - 1, x));
y = Math.max(0, Math.min(src.height - 1, y));
w = Math.max(1, Math.min(src.width - x, w));
h = Math.max(1, Math.min(src.height - y, h));

const out = new PNG({ width: w * scale, height: h * scale });
for (let j = 0; j < out.height; j++) {
  const sy = y + Math.floor(j / scale);
  for (let i = 0; i < out.width; i++) {
    const sx = x + Math.floor(i / scale);
    const s = (sy * src.width + sx) << 2, d = (j * out.width + i) << 2;
    out.data[d] = src.data[s]; out.data[d + 1] = src.data[s + 1];
    out.data[d + 2] = src.data[s + 2]; out.data[d + 3] = src.data[s + 3];
  }
}
fs.writeFileSync(outPath, PNG.sync.write(out));
console.log(`${inPath} ${src.width}x${src.height} → [${x},${y} ${w}x${h}] x${scale} → ${outPath}`);
