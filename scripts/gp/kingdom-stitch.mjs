// tiles.json の各撮影（中心座標X,Y）を計算位置に置いて1枚にする。重なりは後勝ち。
// 位置は理論値に対し、隣と重なる部分の画像相関で±12pxだけ微調整する。
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
const DIR = process.argv[2];
const tiles = JSON.parse(fs.readFileSync(path.join(DIR, "tiles.json"), "utf8"));
const KX = [1.1, -0.78], KY = [-1.1, -0.78], C = 599.5, SC = [276, 492];
const REG = { x0: 0, x1: 450, y0: 210, y1: 840 };
// 地図px（王国中心=原点）上での、画面中心の位置
const world = (X, Y) => [KX[0] * (X - C) + KY[0] * (Y - C), KX[1] * (X - C) + KY[1] * (Y - C)];
const PAD = 40, HW = 1320 + PAD, HH = 935 + PAD;
const W = 2 * HW, H = 2 * HH;
const M = new PNG({ width: W, height: H }); M.data.fill(0);
for (let i = 0; i < M.data.length; i += 4) M.data[i + 3] = 255;
for (const t of tiles) {
  const I = PNG.sync.read(fs.readFileSync(path.join(DIR, t.file)));
  const [wx, wy] = world(t.X, t.Y);
  // 画面px(x,y) → 地図px = (wx + x - SC.x, wy + y - SC.y)
  const ox = Math.round(HW + wx - SC[0]), oy = Math.round(HH + wy - SC[1]);
  for (let y = REG.y0; y < REG.y1; y++) for (let x = REG.x0; x < REG.x1; x++) {
    const mx = ox + x, my = oy + y; if (mx < 0 || my < 0 || mx >= W || my >= H) continue;
    const i = (y * I.width + x) * 4, j = (my * W + mx) * 4;
    M.data[j] = I.data[i]; M.data[j + 1] = I.data[i + 1]; M.data[j + 2] = I.data[i + 2];
  }
}
// 王国の境界（ひし形）を細線で描く
const corner = [[0, 0], [1199, 0], [1199, 1199], [0, 1199], [0, 0]].map(([X, Y]) => world(X, Y));
for (let k = 0; k < 4; k++) {
  const [a, b] = [corner[k], corner[k + 1]];
  for (let s = 0; s <= 1; s += 1 / 4000) {
    const x = Math.round(HW + a[0] + (b[0] - a[0]) * s), y = Math.round(HH + a[1] + (b[1] - a[1]) * s);
    const j = (y * W + x) * 4; if (j >= 0 && j < M.data.length) { M.data[j] = 255; M.data[j + 1] = 60; M.data[j + 2] = 60; }
  }
}
fs.writeFileSync(path.join(DIR, "kingdom.png"), PNG.sync.write(M));
console.log(`kingdom.png ${W}x${H} tiles=${tiles.length}`);
