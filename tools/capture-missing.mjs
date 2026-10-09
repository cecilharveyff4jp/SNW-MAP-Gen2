#!/usr/bin/env node
// 【狙い撃ち】ID未取得の上位メンバー(2/10/11/12/13位など)を確実に取り直す小型ツール。
//   改良点:
//   ・行の境界を画像検出して「行の中心」をタップ → 固定Yのドリフトで隙間を叩く取りこぼしをゼロに（← 11/12/13位の主因）。
//   ・プロフィール撮影は空フレーム(std≈0.9)を弾いて撮り直し（← 2/10位が空だった主因）。
//   ・抜けても BACK だけ／同盟メイン確定時のみ総力ランキングへ。「はい/いいえ」は絶対押さない。
//   上位 --screens 画面ぶん(既定3=ランク1〜16目安)を回すso 5名を必ず含む。取り終えたら全部撮れているので名寄せで拾う。
//
//   使い方:  node tools\capture-missing.mjs --out tools\cap_miss
//   出力: tools\cap_miss\id_*.png（重複込み）。チャットに「done miss」と伝えてください。

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PNG } from "pngjs";

function arg(n, d) { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; }
const ADB = arg("--adb", process.env.ADB || "adb");
const serial = arg("--serial"); const base = serial ? ["-s", serial] : [];
function adb(a) { const r = spawnSync(ADB, [...base, ...a], { encoding: "buffer", maxBuffer: 96 * 1024 * 1024 }); if (r.error) throw new Error(`adb失敗: ${r.error.message}（$env:ADBでadb.exe指定）`); return r; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tap = (x, y) => adb(["shell", "input", "tap", String(Math.round(x)), String(Math.round(y))]);
const swipe = (x1, y1, x2, y2, d) => adb(["shell", "input", "swipe", String(Math.round(x1)), String(Math.round(y1)), String(Math.round(x2)), String(Math.round(y2)), String(d)]);
const cap = () => { const s = adb(["exec-out", "screencap", "-p"]); if (!s.stdout || s.stdout.length < 1000) throw new Error("screencap失敗"); return s.stdout; };

const sz = adb(["shell", "wm", "size"]).stdout.toString(); const mm = sz.match(/(\d+)\s*x\s*(\d+)/);
const W = mm ? +mm[1] : 720, H = mm ? +mm[2] : 1612, cx = Math.round(W / 2);
const outDir = arg("--out", "tools/cap_miss");
const maxScreens = Number(arg("--screens", "3"));
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) { if (/^id_.*\.png$/i.test(f)) fs.rmSync(path.join(outDir, f)); }

function diffFrac(a, b) { const pa = PNG.sync.read(a), pb = PNG.sync.read(b); if (pa.width !== pb.width) return 1; const { width, height, data: da } = pa, db = pb.data; let diff = 0, tot = 0; const y0 = Math.round(height * 0.19), y1 = Math.round(height * 0.90); for (let y = y0; y < y1; y += 12) for (let x = 30; x < width - 30; x += 12) { const i = (y * width + x) * 4; tot++; if (Math.abs(da[i] - db[i]) > 30 || Math.abs(da[i + 1] - db[i + 1]) > 30 || Math.abs(da[i + 2] - db[i + 2]) > 30) diff++; } return diff / tot; }
async function waitStable(maxWait = 6) { let prev = cap(); for (let k = 0; k < maxWait; k++) { await sleep(350); const cur = cap(); if (diffFrac(cur, prev) < 0.008) return; prev = cur; } }
async function scrollToTop() { for (let i = 0; i < 22; i++) { swipe(cx, Math.round(H * 0.30), cx, Math.round(H * 0.82), 250); await sleep(120); } await sleep(600); await waitStable(); }

function onRanking(buf) { const { width, height, data } = PNG.sync.read(buf); let b = 0, t = 0; const y0 = Math.round(height * 0.20), y1 = Math.round(height * 0.85); for (let y = y0; y < y1; y += 14) for (let x = 100; x < width - 100; x += 14) { const i = (y * width + x) * 4; t++; if (data[i] + data[i + 1] + data[i + 2] > 460) b++; } return b / t > 0.35; }
function isBluePad(buf, fx, fy) { const { width, height, data } = PNG.sync.read(buf); const cx0 = Math.round(width * fx), cy0 = Math.round(height * fy); let c = 0, t = 0; for (let y = cy0 - 22; y < cy0 + 22; y++) for (let x = cx0 - 45; x < cx0 + 45; x++) { if (y < 0 || x < 0 || y >= height || x >= width) continue; const i = (y * width + x) * 4; t++; const r = data[i], g = data[i + 1], b = data[i + 2]; if (r < 150 && b > 150 && b - r > 60 && g > 110 && g < 205) c++; } return t > 0 && c / t > 0.4; }
function onAllianceMain(buf) { return isBluePad(buf, 0.26, 0.69) && isBluePad(buf, 0.73, 0.69); }
async function reenterRanking() { if (!onAllianceMain(cap())) return false; tap(Math.round(W * 0.26), Math.round(H * 0.69)); await sleep(1200); await waitStable(); return onRanking(cap()); }
async function returnToList() { adb(["shell", "input", "keyevent", "4"]); await sleep(600); if (onRanking(cap())) return true; if (await reenterRanking()) return true; adb(["shell", "input", "keyevent", "4"]); await sleep(600); if (onRanking(cap())) return true; return await reenterRanking(); }

function isBtn(d, i) { const r = d[i], g = d[i + 1], b = d[i + 2]; return r >= 45 && r <= 120 && g >= 135 && g <= 190 && b >= 225 && (b - r) >= 120 && (b - g) >= 55; }
function findConfirm(buf, rowY) { const { width, height, data } = PNG.sync.read(buf); const y0 = Math.max(0, rowY - 560), y1 = Math.min(height, rowY + 340); let minY = -1; for (let y = y0; y < y1; y++) { let c = 0; const row = y * width * 4; for (let x = 0; x < width; x++) if (isBtn(data, row + x * 4)) c++; if (c > 80) { minY = y; break; } } if (minY < 0) return null; const yEnd = Math.min(height, minY + 70), xMax = Math.floor(width * 0.36); let sx = 0, sy = 0, c = 0; for (let y = minY; y < yEnd; y++) { const row = y * width * 4; for (let x = 0; x < xMax; x++) { const i = row + x * 4; if (isBtn(data, i)) { sx += x; sy += y; c++; } } } return c < 300 ? null : { x: Math.round(sx / c), y: Math.round(sy / c) }; }

// ★行の境界検出：リスト領域で「明るい行カード帯」を見つけ、その中心Yを返す。固定Yではないのでスクロールのドリフトに強い。
function detectRows(buf) {
  const { width, height, data } = PNG.sync.read(buf);
  const x0 = Math.floor(width * 0.35), x1 = Math.floor(width * 0.90);
  const y0 = Math.floor(height * 0.16), y1 = Math.floor(height * 0.90); // ヘッダ下〜固定自分行の上
  const bright = [];
  for (let y = y0; y < y1; y++) { let s = 0, n = 0; for (let x = x0; x < x1; x += 2) { const i = (y * width + x) * 4; s += (data[i] + data[i + 1] + data[i + 2]) / 3; n++; } bright.push(s / n > 150); }
  const centers = []; let st = null;
  const minH = Math.round(height * 0.037); // 行高の約半分(≈60px@1612)より大きい帯のみ＝部分行を除外
  for (let k = 0; k < bright.length; k++) { if (bright[k] && st === null) st = k; if (!bright[k] && st !== null) { if (k - st > minH) centers.push(y0 + Math.floor((st + k) / 2)); st = null; } }
  if (st !== null && bright.length - st > minH) centers.push(y0 + Math.floor((st + bright.length) / 2));
  return centers;
}
// プロフィールのID帯の分散＝空フレーム(遷移途中/未描画)判定。実プロフィール≈42、空≈0.9。
function idBandStd(buf) {
  const { width, height, data } = PNG.sync.read(buf);
  const bx0 = Math.round(width * 0.313), bx1 = Math.round(width * 0.989), by0 = Math.round(height * 0.741), by1 = Math.round(height * 0.825);
  let sum = 0, sum2 = 0, n = 0;
  for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) { const i = (y * width + x) * 4; const g = (data[i] + data[i + 1] + data[i + 2]) / 3; sum += g; sum2 += g * g; n++; }
  const m = sum / n; return Math.sqrt(Math.max(0, sum2 / n - m * m));
}
async function captureProfile() { // 空フレームなら少し待って撮り直し（最大3回）
  let b = cap();
  for (let r = 0; r < 3 && idBandStd(b) < 12; r++) { await sleep(700); b = cap(); }
  return b;
}

console.log(`画面 ${W}x${H} / out=${outDir} / screens=${maxScreens}`);
console.log("最上段へ…"); await scrollToTop();
let saved = 0, blank = 0;
for (let s = 0; s < maxScreens; s++) {
  if (!onRanking(cap())) { if (!(await returnToList())) { console.log("  ⚠ 復帰失敗。中断（はい/いいえ等は押しません）。"); break; } }
  const centers = detectRows(cap());
  console.log(`  screen${s + 1}: 行 ${centers.length}個検出 [${centers.join(",")}]`);
  for (const ry of centers) {
    tap(cx, ry); await sleep(650);
    const buf = cap(); const cc = findConfirm(buf, ry);
    if (!cc) { if (!onRanking(buf)) await returnToList(); continue; }
    tap(cc.x, cc.y); await sleep(850);
    const prof = await captureProfile();
    if (idBandStd(prof) < 12) blank++;
    saved++; fs.writeFileSync(path.join(outDir, `id_${String(saved).padStart(3, "0")}.png`), prof);
    await returnToList();
  }
  swipe(cx, Math.round(H * 0.80), cx, Math.round(H * 0.80) - 5 * Math.round(0.084 * H), 1400);
  await waitStable();
  console.log(`  screen${s + 1} 済（保存 ${saved}, 空 ${blank}）`);
}
console.log(`\n完了: ${saved}枚（空フレーム残り ${blank}）→ ${path.resolve(outDir)}`);
console.log(`チャットに「done miss」と伝えてください。未取得5名の gameId を拾って ranking-ids.json を更新します。`);
