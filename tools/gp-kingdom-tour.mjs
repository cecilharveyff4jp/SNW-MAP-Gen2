// 王国全体マップ撮影。各地点: [都市]→[郊外]でリセット → 座標ジャンプ → 250ノッチ縮小 → 撮影。
// 画面状態を毎段で判定し、想定外なら即中断（Escなどの当てずっぽう操作はしない）。
//   node tools/gp-kingdom-tour.mjs --out <dir> [--from 0] [--limit 99] [--plan]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const OUT = arg("--out"); const FROM = +arg("--from", 0); const LIMIT = +arg("--limit", 999);
const SCR = path.dirname(fileURLToPath(import.meta.url));
const POKE = `${SCR}/gp-poke.ps1`;
const KEY = `${SCR}/gp-key.ps1`;
fs.mkdirSync(OUT, { recursive: true });

// ---- 幾何（最大縮小・中身553x985で実測）: +X → 画面(+1.1,-0.78)/マス, +Y → (-1.1,-0.78)/マス
export const KX = [1.1, -0.78], KY = [-1.1, -0.78];
const C = 599.5;
const toScreen = (X, Y) => [KX[0] * (X - C) + KY[0] * (Y - C), KX[1] * (X - C) + KY[1] * (Y - C)];
const toCoord = (sx, sy) => { const a = sx / 1.1, b = -sy / 0.78; return [C + (a + b) / 2, C + (b - a) / 2]; };
// 地図として使う領域（中身座標）。画面中心(276,492)。
export const REG = { x0: 0, x1: 450, y0: 210, y1: 840 }; const SC = [276, 492];
const RC = [(REG.x0 + REG.x1) / 2 - SC[0], (REG.y0 + REG.y1) / 2 - SC[1]]; // 領域中心-画面中心
const HW = 2640 / 2, HH = 1870 / 2;
function plan() {
  const pts = []; const stepX = 400, stepY = 560;
  const cols = Math.ceil((2 * HW) / stepX), rows = Math.ceil((2 * HH) / stepY);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const rx = -HW + stepX * (c + 0.5) - (cols * stepX - 2 * HW) / 2, ry = -HH + stepY * (r + 0.5) - (rows * stepY - 2 * HH) / 2;
    // 領域矩形のうちひし形の中心に最も近い点がひし形内なら採用
    const nx = Math.max(Math.abs(rx) - 225, 0), ny = Math.max(Math.abs(ry) - 315, 0);
    if (nx / HW + ny / HH > 1) continue;
    let [X, Y] = toCoord(rx - RC[0], ry - RC[1]);
    X = Math.min(1195, Math.max(4, Math.round(X))); Y = Math.min(1195, Math.max(4, Math.round(Y)));
    pts.push({ r, c, X, Y });
  }
  return pts;
}
const PTS = plan();
if (process.argv.includes("--plan")) { console.log(PTS.length); console.log(PTS.map(p => `${p.r},${p.c}: ${p.X},${p.Y}`).join("\n")); process.exit(0); }

// ---- 操作
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const ps = (file, args) => execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", file, ...args.map(String)], { encoding: "utf8" });
const TMP = path.join(OUT, "_state.png");
function shot(p = TMP) { ps(POKE, ["-Wait", "0", "-Out", p]); return PNG.sync.read(fs.readFileSync(p)); }
function click(x, y, wait = 1500, down = 80) { ps(POKE, ["-X", x, "-Y", y, "-Wait", wait, "-Down", down, "-Out", TMP]); }
const key = (keys, text = "") => ps(KEY, ["-Keys", keys, ...(text ? ["-Text", text] : [])]);
function px(I, x, y) { const i = (Math.round(y * I.height) * I.width + Math.round(x * I.width)) * 4; return [I.data[i], I.data[i + 1], I.data[i + 2]]; }
const near = (a, b, t = 18) => a.every((v, i) => Math.abs(v - b[i]) <= t);
function state(I) {
  if (I.width !== 553 || I.height !== 985) return "size";
  if (near(px(I, 0.5, 0.965), [255, 255, 255], 6) && near(px(I, 0.3, 0.94), [255, 255, 255], 6)) return "inputbar";
  if (near(px(I, 0.5, 0.45), [243, 248, 255], 10)) return "dialog";
  const footer = near(px(I, 0.1, 0.975), [82, 117, 173]) && near(px(I, 0.5, 0.015), [42, 66, 99]);
  if (footer) {
    const star = px(I, 0.7, 0.838); return (star[0] > 230 && star[1] > 225 && star[2] < 190) ? "outskirts" : "city";
  }
  return "other"; // 広域表示・チャット等
}
function expect(want, what) { const s = state(shot()); if (s !== want) throw new Error(`${what}: 期待=${want} 実際=${s}`); }
function until(want, act, what, n = 3) {
  for (let i = 0; i < n; i++) { act(); const s = state(shot()); if (s === want) return; console.log(`  retry ${what} (${s})`); sleep(1200); }
  throw new Error(`${what}: ${want} にならない`);
}
function typeField(fx, val) {
  until("inputbar", () => click(fx, 0.49, 1300, 100), `欄(${fx})`);
  key("BS,BS,BS,BS", String(val)); sleep(400);
  key("ENTER"); sleep(900);
  expect("dialog", "Enter後");
}

function capture(p, idx) {
  const tag = `p${String(idx).padStart(2, "0")}_${p.X}_${p.Y}`;
  // リセット
  let s = state(shot());
  if (s === "other") { click(0.905, 0.885, 3500); s = state(shot()); }      // 広域の[都市]
  if (s === "outskirts") { click(0.905, 0.96, 3500); s = state(shot()); }   // フッターの[都市]
  if (s !== "city") throw new Error(`都市に入れない (${s})`);
  until("outskirts", () => click(0.90, 0.955, 5500, 100), "郊外");
  // ジャンプ
  until("dialog", () => click(0.30, 0.837, 1500), "座標ダイアログ");
  typeField(0.34, p.X); typeField(0.71, p.Y);
  shot(path.join(OUT, `${tag}_dlg.png`));
  click(0.50, 0.59, 4000);
  const j = shot(path.join(OUT, `${tag}_jump.png`));
  if (state(j) !== "outskirts") throw new Error(`ジャンプ後: ${state(j)}`);
  // 縮小
  for (let i = 0; i < 5; i++) ps(POKE, ["-Wheel", -50, "-WheelX", 0.5, "-WheelY", 0.5, "-WheelStepMs", 150, "-Wait", 1200, "-Out", TMP]);
  sleep(1500);
  const I = shot(path.join(OUT, `${tag}.png`));
  if (state(I) !== "other") throw new Error(`縮小後: ${state(I)}`);
  return tag;
}

const log = path.join(OUT, "tiles.json");
const done = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log, "utf8")) : [];
for (let i = FROM; i < Math.min(PTS.length, FROM + LIMIT); i++) {
  const p = PTS[i];
  console.log(`[${i + 1}/${PTS.length}] ${p.X},${p.Y}`);
  const tag = capture(p, i);
  done.push({ ...p, i, file: `${tag}.png` });
  fs.writeFileSync(log, JSON.stringify(done, null, 1));
}
console.log("ok");
