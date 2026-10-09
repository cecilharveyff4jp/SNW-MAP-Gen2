#!/usr/bin/env node
// 【統合・全自動】総力ランキング取得 → 最上段へ自動復帰 → クローズドループでID取得、を1コマンドで。
//   Phase1: 総力ランキングを上から下まで自動スクロール連続キャプチャ（rank_*.png）。最下部を自動検知して停止。
//           → 正確な総力・名前・人数N はこの画像から読む（丸めない）。
//   Phase2: 最上段へ戻り、各行タップ→「確認」青ボタンを画像検出→領主ファイル撮影→BACK（id_*.png）。最下部で自動停止。
//   依存: pngjs（npm.cmd install pngjs）。要 $env:ADB。
//
//   使い方:  node tools\capture-all.mjs --out tools\cap
//   出力: tools\cap\rank_*.png（総力）と tools\cap\id_*.png（ID）。撮り終えたらチャットに読ませる。

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
const outDir = arg("--out", "tools/cap");
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) { if (/^(rank|id|miss)_.*\.png$/i.test(f)) fs.rmSync(path.join(outDir, f)); }

// --- リスト領域の類似度（最下部検知）: サンプル点で色差>30の割合。小さいほど同じ ---
function diffFrac(a, b) {
  const pa = PNG.sync.read(a), pb = PNG.sync.read(b); if (pa.width !== pb.width) return 1;
  const { width, height, data: da } = pa, db = pb.data;
  let diff = 0, tot = 0; const y0 = Math.round(height * 0.19), y1 = Math.round(height * 0.90);
  for (let y = y0; y < y1; y += 12) for (let x = 30; x < width - 30; x += 12) { const i = (y * width + x) * 4; tot++; if (Math.abs(da[i] - db[i]) > 30 || Math.abs(da[i + 1] - db[i + 1]) > 30 || Math.abs(da[i + 2] - db[i + 2]) > 30) diff++; }
  return diff / tot;
}
// 「確認」青ボタン検出（capture-ids と同じ）
function isBtn(d, i) { const r = d[i], g = d[i + 1], b = d[i + 2]; return r >= 45 && r <= 120 && g >= 135 && g <= 190 && b >= 225 && (b - r) >= 120 && (b - g) >= 55; }
function findConfirm(buf, rowY) {
  const { width, height, data } = PNG.sync.read(buf);
  const y0 = Math.max(0, rowY - 560), y1 = Math.min(height, rowY + 340);
  let minY = -1;
  for (let y = y0; y < y1; y++) { let c = 0; const row = y * width * 4; for (let x = 0; x < width; x++) if (isBtn(data, row + x * 4)) c++; if (c > 80) { minY = y; break; } }
  if (minY < 0) return null;
  const yEnd = Math.min(height, minY + 70), xMax = Math.floor(width * 0.36); let sx = 0, sy = 0, c = 0;
  for (let y = minY; y < yEnd; y++) { const row = y * width * 4; for (let x = 0; x < xMax; x++) { const i = row + x * 4; if (isBtn(data, i)) { sx += x; sy += y; c++; } } }
  return c < 300 ? null : { x: Math.round(sx / c), y: Math.round(sy / c) };
}
// ★行の境界検出：リスト領域で「明るい行カード帯」の中心Yを返す。固定Yではないのでスクロールのドリフトに強い＝隙間タップ0。
//   64位スマートEX(自分)も列に出るので普通に検出・タップされる（特別扱いしない）。末尾の固定自分行(画面下端)は範囲外で除外。
function detectRows(buf) {
  const { width, height, data } = PNG.sync.read(buf);
  const x0 = Math.floor(width * 0.35), x1 = Math.floor(width * 0.90);
  const y0 = Math.floor(height * 0.16), y1 = Math.floor(height * 0.90);
  const bright = [];
  for (let y = y0; y < y1; y++) { let s = 0, n = 0; for (let x = x0; x < x1; x += 2) { const i = (y * width + x) * 4; s += (data[i] + data[i + 1] + data[i + 2]) / 3; n++; } bright.push(s / n > 150); }
  const centers = []; let st = null; const minH = Math.round(height * 0.037);
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
async function captureProfile() { let b = cap(); for (let r = 0; r < 3 && idBandStd(b) < 12; r++) { await sleep(700); b = cap(); } return b; }

async function scrollToTop() { for (let i = 0; i < 22; i++) { swipe(cx, Math.round(H * 0.30), cx, Math.round(H * 0.82), 250); await sleep(120); } await sleep(600); await waitStable(); }

// スクロール後、画面が静止する（前フレームと差が小さくなる）まで待つ＝中途半端な状態でタップしない
async function waitStable(maxWait = 6) { let prev = cap(); for (let k = 0; k < maxWait; k++) { await sleep(350); const cur = cap(); if (diffFrac(cur, prev) < 0.008) return; prev = cur; } }

// 総力ランキング画面に居るか（リスト領域が明るい＝薄青の行が並ぶ）。同盟メイン等は暗いのでfalse。
function onRanking(buf) { const { width, height, data } = PNG.sync.read(buf); let b = 0, t = 0; const y0 = Math.round(height * 0.20), y1 = Math.round(height * 0.85); for (let y = y0; y < y1; y += 14) for (let x = 100; x < width - 100; x += 14) { const i = (y * width + x) * 4; t++; if (data[i] + data[i + 1] + data[i + 2] > 460) b++; } return b / t > 0.35; }
// 指定の相対位置(fx,fy)付近が「鮮やか青のボタン面」か（同盟メインの機能ボタン色）。
function isBluePad(buf, fx, fy) {
  const { width, height, data } = PNG.sync.read(buf);
  const cx0 = Math.round(width * fx), cy0 = Math.round(height * fy); let c = 0, t = 0;
  for (let y = cy0 - 22; y < cy0 + 22; y++) for (let x = cx0 - 45; x < cx0 + 45; x++) {
    if (y < 0 || x < 0 || y >= height || x >= width) continue; const i = (y * width + x) * 4;
    // 機能ボタンの「濃い青」だけ拾う。薄青のランキング行(赤も高い)は除外＝一覧を同盟メインと誤認しない。
    t++; const r = data[i], g = data[i + 1], b = data[i + 2]; if (r < 150 && b > 150 && b - r > 60 && g > 110 && g < 205) c++;
  }
  return t > 0 && c / t > 0.4;
}
// 同盟メイン画面か（「総力ランキング」と「同盟援助」の2ボタンが両方とも鮮やか青の面）。
// ここは「はい/いいえ」等のダイアログが出ない安全な画面。両方一致でないと再入場タップはしない。
function onAllianceMain(buf) { return isBluePad(buf, 0.26, 0.69) && isBluePad(buf, 0.73, 0.69); }

// ★安全復帰:
//   叩くのは「ランキングの行」「画像検出した確認(青)」、そして同盟メインと確定できた時の「総力ランキング」だけ。
//   ランキングに居るのに BACK を押すと同盟メインへ抜けてしまう＝BACKの押しすぎが最大の事故要因。
//   なので「BACKは押しすぎない・毎回 waitStable で静止させてから判定」を徹底する。「はい/いいえ」は絶対に押さない。
async function reenterRanking() {           // 同盟メインと確定できた時だけ、総力ランキングを開いて最上段へ
  if (!onAllianceMain(cap())) return false;
  tap(Math.round(W * 0.26), Math.round(H * 0.69)); await sleep(1200); await waitStable();
  return onRanking(cap());
}
async function returnToList() {   // カード/プロフィール→一覧。BACK1回→判定。押しすぎない（固定待ちで高速）。
  adb(["shell", "input", "keyevent", "4"]); await sleep(600);
  if (onRanking(cap())) return true;              // 通常はこれで一覧に戻る
  if (await reenterRanking()) return true;        // 同盟メインに抜けていた→安全に再入場
  adb(["shell", "input", "keyevent", "4"]); await sleep(600);   // profile→card→list の2段だった場合
  if (onRanking(cap())) return true;
  return await reenterRanking();
}

console.log(`画面 ${W}x${H} / out=${outDir}`);
// ===== Phase1: 総力ランキング =====
console.log("Phase1: 総力ランキングをキャプチャ（最下部で自動停止）");
await scrollToTop();
let prev = null, rn = 0;
for (let i = 0; i < 30; i++) {
  const shot = cap();
  if (prev && diffFrac(shot, prev) < 0.01) { console.log(`  最下部検知。ランキング${rn}枚で停止`); break; }
  rn++; fs.writeFileSync(path.join(outDir, `rank_${String(rn).padStart(2, "0")}.png`), shot); console.log(`  saved rank_${String(rn).padStart(2, "0")}.png`);
  prev = shot;
  swipe(cx, Math.round(H * 0.60), cx, Math.round(H * 0.36), 600); await sleep(500);
}

// ===== 最上段へ戻る =====
console.log("最上段へ戻る…"); await scrollToTop();

// ===== Phase2: クローズドループでID =====
console.log("Phase2: 領主ファイル(ID)をクローズドループ取得（最下部で自動停止）");
const wpop = 650, wprof = 850;   // カード出現待ち / プロフィール表示待ち（実績値）
let saved = 0, miss = 0, blank = 0, prevScreen = null;
for (let s = 0; s < 30; s++) {
  // 画面の頭で一覧に居ることだけ確認（スクロール直後は既に静止済み）。抜けていれば安全に復帰。
  if (!onRanking(cap())) {
    if (!(await returnToList())) { console.log("  ⚠ ランキングに復帰できません。安全のため中断（はい/いいえ等は押しません）。"); break; }
  }
  // ★固定Yではなく「実際の行の中心」を検出して順にタップ＝隙間タップの取りこぼし0。自分(スマートEX)も普通に含まれる。
  const centers = detectRows(cap());
  for (let i = 0; i < centers.length; i++) {
    const ry = centers[i]; tap(cx, ry); await sleep(wpop);
    const buf = cap(); const cc = findConfirm(buf, ry);
    if (!cc) {
      miss++;
      try { fs.writeFileSync(path.join(outDir, `miss_s${s + 1}_r${i + 1}.png`), buf); } catch {}  // 原因診断用
      // 一覧のまま＝カードが開かなかった→ ここで BACK すると一覧を抜けるので押さない。次行へ。
      // 一覧でない＝カード/別画面が開いた → 安全に一覧へ戻す（BACKは押しすぎない）。
      if (!onRanking(buf)) await returnToList();
      continue;
    }
    tap(cc.x, cc.y); await sleep(wprof);
    const prof = await captureProfile();   // 空フレームなら撮り直し
    if (idBandStd(prof) < 12) blank++;
    saved++; fs.writeFileSync(path.join(outDir, `id_${String(saved).padStart(3, "0")}.png`), prof);
    await returnToList();   // プロフィール→一覧 へ（BACK1回→判定、押しすぎない）。
  }
  const screen = cap();
  if (prevScreen && diffFrac(screen, prevScreen) < 0.01) { console.log(`  最下部検知。ID ${saved}枚で停止`); break; }
  prevScreen = screen;
  swipe(cx, Math.round(H * 0.80), cx, Math.round(H * 0.80) - 5 * Math.round((0.298 - 0.214) * H), 1400);
  await waitStable();  // ★中途半端なスクロール状態でタップしないよう、静止するまで待つ
  console.log(`  screen${s + 1} 済（ID ${saved}枚, miss ${miss}, 空 ${blank}）`);
}
console.log(`\n完了: ランキング${rn}枚 + 領主ファイル${saved}枚（miss ${miss}, 空 ${blank}）→ ${path.resolve(outDir)}`);
console.log(`チャットに「done」と伝えてください。総力(正確)＋ID を紐づけて ranking-ids.json を作ります。`);
