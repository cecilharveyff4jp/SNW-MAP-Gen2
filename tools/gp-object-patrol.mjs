// DBオブジェクトの座標へ順にジャンプ → 画面中央をクリック → カードを撮る → Escで閉じる。
// 読み取り専用（カードのボタンは押さない）。各段で画面状態を確認し、想定外なら中断。
//   node tools/gp-object-patrol.mjs --objs <list.json> --out <dir> [--from 0] [--limit 99]
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
const objs = JSON.parse(fs.readFileSync(arg("--objs"), "utf8"));

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
  if (footer) { const s = px(I, 0.7, 0.838); return (s[0] > 230 && s[1] > 225 && s[2] < 190) ? "outskirts" : "city"; }
  return "other";
}
function until(want, act, what, n = 3) {
  for (let i = 0; i < n; i++) { act(); const s = state(shot()); if (s === want) return; console.log(`  retry ${what} (${s})`); sleep(1200); }
  throw new Error(`${what}: ${want} にならない`);
}
function typeField(fx, val) {
  until("inputbar", () => click(fx, 0.49, 1300, 100), `欄(${fx})`);
  key("BS,BS,BS,BS", String(val)); sleep(400); key("ENTER"); sleep(900);
  if (state(shot()) !== "dialog") throw new Error("Enter後にダイアログでない");
}
// カードが開いたか: 開くと座標ボックスが隠れる/中央付近が大きく変わる。判定は「outskirtsのままか」で行う。
const res = [];
const log = path.join(OUT, "patrol.json");
if (state(shot()) !== "outskirts") throw new Error(`開始時に郊外標準表示でない: ${state(shot())}`);
for (let i = FROM; i < Math.min(objs.length, FROM + LIMIT); i++) {
  const o = objs[i]; const tag = `o${String(i).padStart(2, "0")}_${o.type}_${o.anchor_x}_${o.anchor_y}`;
  console.log(`[${i + 1}/${objs.length}] ${o.type} ${o.label ?? ""} ${o.anchor_x},${o.anchor_y}`);
  until("dialog", () => click(0.30, 0.837, 1500), "座標ダイアログ");
  typeField(0.34, o.anchor_x); typeField(0.71, o.anchor_y);
  click(0.50, 0.59, 3500);
  const A = shot(path.join(OUT, `${tag}_at.png`)); if (state(A) !== "outskirts") throw new Error("ジャンプ後が郊外でない");
  click(0.50, 0.48, 1800);
  const I = shot(path.join(OUT, `${tag}_card.png`));
  const st = state(I);
  let d = 0, n = 0; for (let y = 200; y < 840; y += 3) for (let x = 0; x < 553; x += 3) { const k = (y * 553 + x) * 4; d += Math.abs(A.data[k] - I.data[k]) + Math.abs(A.data[k + 1] - I.data[k + 1]) + Math.abs(A.data[k + 2] - I.data[k + 2]); n++; }
  const diff = d / n / 3; const opened = st !== "outskirts" || diff > 10;
  console.log(`  diff=${diff.toFixed(1)} state=${st} card=${opened}`);
  if (opened) { key("ESC"); sleep(1200); }
  if (opened) { const B = shot(); let e = 0; let m = 0; for (let y = 808; y < 842; y++) for (let x = 160; x < 400; x++) { const k = (y * 553 + x) * 4; e += Math.abs(A.data[k] - B.data[k]); m++; } if (e / m > 20) throw new Error("Esc後も画面がジャンプ直後と違う"); }
  const after = state(shot());
  if (after !== "outskirts") throw new Error(`Esc後が郊外でない: ${after}`);
  res.push({ ...o, i, tag, cardState: st });
  fs.writeFileSync(log, JSON.stringify(res, null, 1));
}
console.log("ok");
