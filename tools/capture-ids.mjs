#!/usr/bin/env node
// 総力ランキング → 領主ファイル(ID) を自動取得【クローズドループ版】。
//
// ★仕組み: 行をタップ→スクショ→画像から「確認」ボタン(左上の鮮やか青)を検出→そこを正確に叩く→
//   領主ファイルを撮影→BACK。座標決め打ちに頼らないので、スクロールの位相ズレ・ポップアップ反転・
//   末尾でも安定。しかも「削除する」はオレンジで青マスクに掛からず＝誤爆しない（安全）。
//
// 依存: pngjs（純JS）。事前に  npm install pngjs
//
// 使い方:
//   node tools\capture-ids.mjs --from-ranking tools\ranking.json --out tools\ids
//   （--screens で明示も可。--rows-y で処理行Yを上書き可）
//
// 出力: 領主ファイル画像 id_XXX.png（+ 検出ログ）。チャットに読ませて 名前+ID → 順位に名寄せ。

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PNG } from "pngjs";

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }
const ADB = arg("--adb", process.env.ADB || "adb");
const serial = arg("--serial");
const base = serial ? ["-s", serial] : [];
function adb(a) { const r = spawnSync(ADB, [...base, ...a], { encoding: "buffer", maxBuffer: 96 * 1024 * 1024 }); if (r.error) throw new Error(`adb失敗: ${r.error.message}（$env:ADBでadb.exe指定）`); return r; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tap = (x, y) => adb(["shell", "input", "tap", String(Math.round(x)), String(Math.round(y))]);
const screencap = () => { const s = adb(["exec-out", "screencap", "-p"]); if (!s.stdout || s.stdout.length < 1000) throw new Error("screencap失敗"); return s.stdout; };

// 画面サイズ
const sz = adb(["shell", "wm", "size"]).stdout.toString();
const m = sz.match(/(\d+)\s*x\s*(\d+)/); const W = m ? +m[1] : 720, H = m ? +m[2] : 1612;
const tapx = Number(arg("--tapx", Math.round(W / 2)));

// 処理する行Y（上から。末尾の固定行に近い最下段は避ける）。反転ポップアップも検出で対応するので下段も可。
// 最下段(固定行の直前)まで処理して末尾も拾う。反転ポップアップも検出で対応。
const rowFrac = [0.214, 0.298, 0.382, 0.466, 0.550, 0.634, 0.713, 0.797, 0.876];
let rowYs = arg("--rows-y", null) ? arg("--rows-y").split(",").map((s) => Math.round(Number(s))) : rowFrac.map((f) => Math.round(f * H));

let screens = Number(arg("--screens", "0"));
const fromRanking = arg("--from-ranking", null);
if (fromRanking) { const arr = JSON.parse(fs.readFileSync(fromRanking, "utf8")); const N = Array.isArray(arr) ? arr.length : 0; screens = Math.ceil(N / 4) + 2; console.log(`N=${N} → screens=${screens}（${rowYs.length}行/画面・約5行送りで重複、名寄せで除去）`); }
if (!screens) screens = 12;

const outDir = arg("--out", "tools/ids");
const wpop = Number(arg("--wpop", "650")), wprof = Number(arg("--wprof", "900")), wback = Number(arg("--wback", "650"));
// 画面送り：ゆっくり約5行ぶんドラッグ（フリング抑制）。処理は7行なので必ず重複＝飛ばさない。
const rowH = Math.round((rowFrac[1] - rowFrac[0]) * H);
const sy1 = Math.round(H * 0.80), sy2 = sy1 - 5 * rowH, scrollDur = Number(arg("--dragdur", "1500"));

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) { if (/^id_\d+\.png$/i.test(f)) fs.rmSync(path.join(outDir, f)); }

// 「確認」ボタン検出：鮮やか青(ボタン)のうち、行付近バンドの最上段・左列＝確認。
function isBtnBlue(d, i) { const r = d[i], g = d[i + 1], b = d[i + 2]; return r >= 45 && r <= 120 && g >= 135 && g <= 190 && b >= 225 && (b - r) >= 120 && (b - g) >= 55; }
function findConfirm(buf, rowY) {
  const png = PNG.sync.read(buf); const { width, height, data } = png;
  const y0 = Math.max(0, rowY - 560), y1 = Math.min(height, rowY + 340);
  // 行付近バンドで「青ボタン画素が横に十分ある行」の最上端 minY を探す（残ピクセル誤検出を除外）
  let minY = -1;
  for (let y = y0; y < y1; y++) { let cnt = 0; const row = y * width * 4; for (let x = 0; x < width; x++) { if (isBtnBlue(data, row + x * 4)) cnt++; } if (cnt > 80) { minY = y; break; } }
  if (minY < 0) return null;
  // 最上段ボタンの左列（x<0.36W）＝確認 の重心
  const yEnd = Math.min(height, minY + 70), xMax = Math.floor(width * 0.36);
  let sx = 0, sy = 0, c = 0;
  for (let y = minY; y < yEnd; y++) { const row = y * width * 4; for (let x = 0; x < xMax; x++) { const i = row + x * 4; if (isBtnBlue(data, i)) { sx += x; sy += y; c++; } } }
  if (c < 300) return null;
  return { x: Math.round(sx / c), y: Math.round(sy / c), n: c };
}

// ── 「今ランキング画面か」の判定 ────────────────────────────────────────────
// ★これが無いと事故る。実際に起きた事故: 自分の行をタップしても確認ポップアップは出ない（自分の領主
//   ファイルは別UIで「確認」ボタンが無い）。旧コードは検出失敗＝ポップアップが開いていると決めつけて
//   BACK を押していたので、ランキング画面のまま BACK ＝ ランキングを閉じてしまい、以降は郊外マップを
//   延々タップし続けた（21行ぶん無駄撃ち）。
// 判定は選択タブ「総力ランキング」の白い帯。実測（全ランキング画像で一致）:
//   ランキング (200,220,230) / 自分の領主 (73,80,146) / 他人の領主 (67,75,140) / 郊外マップ (129,148,185)
// b-r も見る（ランキング30に対し領主ファイルは80超）。明るいだけの画面と取り違えないため。
function isRankingScreen(buf) {
  const png = PNG.sync.read(buf); const { width, height, data } = png;
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.round(0.09 * height); y < Math.round(0.12 * height); y++)
    for (let x = Math.round(0.04 * width); x < Math.round(0.33 * width); x++) { const i = (y * width + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  r /= n; g /= n; b /= n;
  return r >= 170 && g >= 195 && b >= 205 && (b - r) <= 50;
}

// ランキング画面へ戻す。戻れなければ諦めて止める（勝手に叩き続ける方が害が大きい）。
async function ensureRanking(maxBacks = 4) {
  for (let k = 0; k <= maxBacks; k++) {
    if (isRankingScreen(screencap())) return true;
    adb(["shell", "input", "keyevent", "4"]); await sleep(700);
  }
  return false;
}

console.log(`画面 ${W}x${H} / rowYs=[${rowYs.join(",")}] / screens=${screens}`);
let saved = 0, miss = 0, selfSkip = 0, missStreak = 0;
for (let s = 0; s < screens; s++) {
  // 画面の切り替わりごとに1回だけ確認する（毎行やると Wi-Fi では撮影コストが倍になる）。
  if (!isRankingScreen(screencap())) {
    console.log(`  [!] screen${s + 1} 開始時にランキング画面ではありません。復帰を試みます。`);
    if (!await ensureRanking()) { console.error("ランキング画面に戻れませんでした。中断します。同盟→ランキング→総力 を開き直してから再実行してください。"); break; }
    console.log("  復帰しました。");
  }
  for (let i = 0; i < rowYs.length; i++) {
    const ry = rowYs[i];
    tap(tapx, ry); await sleep(wpop);
    const buf = screencap();
    const cc = findConfirm(buf, ry);
    if (!cc) {
      miss++;
      try { fs.writeFileSync(path.join(outDir, `miss_s${s + 1}_r${i + 1}.png`), buf); } catch {}
      // ★ここが事故の分岐点。まだランキングが見えている＝ポップアップは開いていない
      //   （自分の行／行間の隙間をタップした）。この状況で BACK を押すとランキングごと閉じる。
      if (isRankingScreen(buf)) {
        selfSkip++; missStreak = 0;
        console.log(`  skip  screen${s + 1} row${i + 1} (rowY=${ry}) ポップアップ無し（自分の行/隙間）。BACKは押さない。`);
        // 自分の行は順位が上下するので位置では判定しない。ここは「開かなかった」で拾っている。
        // ただし profile が遅れて開くこともあるので、次の行へ進む前にもう一度だけ確かめる
        // （ensureRanking はランキングならBACKを押さずに即 true を返す）。
        if (!await ensureRanking()) { console.error("ランキング画面に戻れませんでした。中断します。同盟→ランキング→総力 を開き直してから再実行してください。"); s = screens; break; }
        continue;
      }
      // ランキングから外れている＝何か別の画面が開いた。閉じて必ずランキングまで戻す。
      adb(["shell", "input", "keyevent", "4"]); await sleep(500);
      if (!await ensureRanking()) { console.error("ランキング画面に戻れませんでした。中断します。同盟→ランキング→総力 を開き直してから再実行してください。"); s = screens; break; }
      console.log(`  miss  screen${s + 1} row${i + 1} (rowY=${ry}) 確認未検出→閉じてランキングへ復帰`);
      if (++missStreak >= 5) { console.error("確認ボタンの未検出が5回続きました。画面かパラメータがずれています。中断します。"); s = screens; break; }
      continue;
    }
    missStreak = 0;
    tap(cc.x, cc.y); await sleep(wprof);
    saved++;
    const file = path.join(outDir, `id_${String(saved).padStart(3, "0")}.png`);
    fs.writeFileSync(file, screencap());
    console.log(`  saved ${file}  確認=(${cc.x},${cc.y})`);
    adb(["shell", "input", "keyevent", "4"]); await sleep(wback);
  }
  if (s < screens - 1) { adb(["shell", "input", "swipe", String(tapx), String(sy1), String(tapx), String(sy2), String(scrollDur)]); await sleep(800); }
}
console.log(`\n完了: 領主ファイル ${saved}枚（自分の行/隙間のスキップ ${selfSkip} / 未検出 ${miss - selfSkip}）を ${path.resolve(outDir)} に保存。`);
console.log(`チャットに読ませ、名前+ID+炉レベル を順位に名寄せします（重複除去）。`);
