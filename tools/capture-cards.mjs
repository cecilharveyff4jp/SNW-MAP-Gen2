#!/usr/bin/env node
// 【都市カード ウォッチ取得モード】郊外マップでオーナーが都市をタップ→ツールは画面を監視し、
//   都市カードが出たら全画面を1枚保存する（座標・名前・総力はカード内にあるので後でチャットで読む）。
//   カードの表示位置は固定でないため、位置決め打ちではなく画面全体から都市カードのUIを探して検知する。
//   同じカードは1回だけ（前回保存とカード領域の差分が小さければスキップ）。オーナーは次の都市をタップして繰り返す。
//   終了は Ctrl+C。依存: pngjs（tools/package.json）。要 $env:ADB。
//
//   使い方:  node tools\capture-cards.mjs --out tools\cards\cap
//   出力: tools\cards\cap\card_001.png ... 撮り終えたらチャットで「done cards」。私が名前+座標+総力を読み、
//         placed=0 のメンバーに突き合わせて anchor_x/anchor_y を入れ placed=1 にします（座標ズレ修正も可）。
//
//   ペース: 1周およそ0.8秒。カードを出したら1秒ほど置いてから次の都市をタップしてください。

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PNG } from "pngjs";

function arg(n, d) { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; }
const ADB = arg("--adb", process.env.ADB || "adb");
const serial = arg("--serial"); const base = serial ? ["-s", serial] : [];
function adb(a) { const r = spawnSync(ADB, [...base, ...a], { encoding: "buffer", maxBuffer: 128 * 1024 * 1024 }); if (r.error) throw new Error(`adb失敗: ${r.error.message}（$env:ADBでadb.exe指定）`); return r; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 画面取得 ──────────────────────────────────────────────────────────────
// 監視は raw（端末側のPNG圧縮を省くぶん速い。実測 531ms vs 788ms）、保存する1枚だけ PNG で撮る。
// raw の先頭は width,height,format(,colorSpace) の uint32 が並ぶ。ヘッダ長は機種で12/16があるので実測で判定。
function capRaw() {
  const b = adb(["exec-out", "screencap"]).stdout;
  if (!b || b.length < 32) throw new Error("screencap(raw)失敗");
  const width = b.readUInt32LE(0), height = b.readUInt32LE(4);
  const head = b.length === width * height * 4 + 12 ? 12 : b.length === width * height * 4 + 16 ? 16 : -1;
  if (head < 0) throw new Error(`screencap(raw) サイズ不一致 ${b.length}`);
  return { width, height, data: b.subarray(head) };
}
function capPng() {
  const b = adb(["exec-out", "screencap", "-p"]).stdout;
  if (!b || b.length < 1000) throw new Error("screencap(png)失敗");
  return b;
}
const toImg = (pngBuf) => { const p = PNG.sync.read(pngBuf); return { width: p.width, height: p.height, data: p.data }; };

const outDir = arg("--out", "tools/cards/cap");
const POLL = Number(arg("--poll", "250"));       // 監視の追加待ちms（1周は screencap 込みで約0.8秒）
const MINROWS = Number(arg("--minrows", "5"));   // 青ボタンの行の最小本数（実測: 都市カード13前後 / マップ0）
const MAXSAVE = Number(arg("--max", "300"));
fs.mkdirSync(outDir, { recursive: true });
// ★既存の card_*.png は消さずに連番を続ける。起動＝全消しにすると、うっかり二重起動やスクリプトの
//   取り違えで撮影済みの一式が消える（実際に消した）。要らなくなったらフォルダごと手で消せばよい。
const existing = fs.readdirSync(outDir).map((f) => /^card_(\d+)\.png$/i.exec(f)).filter(Boolean).map((m) => Number(m[1]));
const startNo = existing.length ? Math.max(...existing) : 0;
if (startNo) console.log(`※ 既存の card_*.png が${existing.length}枚あります。card_${String(startNo + 1).padStart(3, "0")}.png から続けます。`);

// ── 都市カード検知 ────────────────────────────────────────────────────────────
// ★カードの見た目（背景の色・柄）はプレイヤーごとのスキンで変わる。白青/緑/橙などが混在するので、
//   「明るい青白のボディ帯」を探す方式では取りこぼす。明るさ＋平坦さでの判定もマップの地面
//   （(183,193,220)・完全に平坦）と区別できない。→ **スキンで変わらないUI固定色**を手掛かりにする。
//
//   ①カード左上の杖アイコンの背景 (13,194,216)  … これが決め手。全スキン共通で必ず在る。
//   ②下部ボタンの青 (79,165,252)                 … カードである裏付け（1個でよい）。
//
//   ※以前は「同じ行に青ボタンが2つ」を条件にしていたが、小規模アカウントのカードは
//     「部隊援助」1個しかボタンが無く、りつごろｰ が何度タップしても撮れなかった。杖アイコン基準に変更。
//   実測較正: 都市カード(白青/緑/橙/自分の都市/ボタン1個) = 杖16px・青ボタン行13前後 /
//             同盟旗カード = 杖2px / マップのみ = 杖0px / 領主ファイル = 杖0px。
const WAND = [13, 194, 216], WTOL = 22, WAND_MINRUN = 16;
const BTN = [79, 165, 252], TOL = 18, STEP = 2, MIN_BTN_FRAC = 0.12;
const isWand = (r, g, b) => Math.abs(r - WAND[0]) <= WTOL && Math.abs(g - WAND[1]) <= WTOL && Math.abs(b - WAND[2]) <= WTOL;
const isBtn = (r, g, b) => Math.abs(r - BTN[0]) <= TOL && Math.abs(g - BTN[1]) <= TOL && Math.abs(b - BTN[2]) <= TOL;
const CARD_W = 415;   // カード幅はほぼ一定（実測 408〜412px @720幅）。杖の位置から本体の範囲を割り出す。

// 杖アイコン: 一定幅以上続くアイコン色の行が縦に連なっている塊を探す（キラキラの白で切れるので短い run で判定）
function findWand(data, width, height) {
  let best = 0, cs = -1, bx = -1, by = -1, cx = 0;
  for (let y = Math.round(height * 0.08); y < Math.round(height * 0.95); y++) {
    const row = y * width * 4;
    let run = 0, bestRun = 0, start = -1, bestStart = -1;
    for (let x = 0; x < width; x += STEP) {
      const i = row + x * 4;
      if (isWand(data[i], data[i + 1], data[i + 2])) { if (start < 0) start = x; run += STEP; if (run > bestRun) { bestRun = run; bestStart = start; } }
      else { run = 0; start = -1; }
    }
    if (bestRun >= WAND_MINRUN) { if (cs < 0) { cs = y; cx = bestStart; } const h = y - cs + 1; if (h > best) { best = h; by = cs; bx = cx; } }
    else cs = -1;
  }
  return { h: best, x: bx, y: by };
}

// 青ボタンの行数（1行に幅のある区間が1つ以上あれば数える）
function btnRowCount(data, width, height) {
  let rows = 0;
  for (let y = Math.round(height * 0.10); y < Math.round(height * 0.95); y++) {
    const row = y * width * 4;
    let s = -1, ok = false;
    for (let x = 0; x < width; x += STEP) {
      const i = row + x * 4;
      if (isBtn(data[i], data[i + 1], data[i + 2])) { if (s < 0) s = x; }
      else { if (s >= 0 && x - s >= width * MIN_BTN_FRAC) ok = true; s = -1; }
    }
    if (s >= 0 && width - s >= width * MIN_BTN_FRAC) ok = true;
    if (ok) rows++;
  }
  return rows;
}

function cardInfo(img) {
  const { width, height, data } = img;
  const w = findWand(data, width, height);
  if (w.h < 10) return { rows: 0, wand: w.h };
  const rows = btnRowCount(data, width, height);
  if (rows < MINROWS) return { rows: 0, wand: w.h };
  // 杖アイコンはカード左上の内側。そこから本体（X:Y / 名前 / 戦闘力 / 同盟）の範囲を割り出す。
  const x0 = Math.max(0, w.x - 24);
  return { rows, wand: w.h, x0, x1: Math.min(width - 1, x0 + CARD_W), y0: Math.max(0, w.y - 12), y1: Math.min(height - 1, w.y + 300) };
}
const isCard = (info) => info.rows >= MINROWS;

// ★モーダルダイアログ除け。「比率配分」など青ボタンが並ぶ設定ダイアログを都市カードと誤検知していた。
//   ダイアログは画面全体を暗転させるので、カードが絶対に届かない上端HUD帯の明るさで分離できる。
//   実測: ダイアログ 29 / 都市カード・マップ 117〜125。閾値70で余裕をもって分かれる。
const DIM_MIN = Number(arg("--dim-min", "70"));
function hudBrightness(img) {
  const { width, height, data } = img;
  let s = 0, n = 0;
  for (let y = Math.round(height * 0.02); y < Math.round(height * 0.09); y += 2)
    for (let x = 0; x < width; x += 2) { const k = (y * width + x) * 4; s += (data[k] + data[k + 1] + data[k + 2]) / 3; n++; }
  return s / n;
}

// カード本体の領域だけを比べる。★全画面比較にすると背景アニメ（メリーゴーランド/行軍タイマー/雲）だけで
//   常時7%前後動くため、「静止待ち」が永久に収束せず1枚あたり約6.6秒を空費し、その間のタップを取りこぼす。
//   実測: 同じカード → 全画面7.6% / カード領域0.0%、別カード → カード領域76〜99%。
function diffRegion(a, b, info) {
  if (!a || !b || a.width !== b.width || !info.rows) return 1;
  const { width, data: da } = a, db = b.data;
  let d = 0, t = 0;
  for (let y = info.y0; y <= info.y1; y += 3) for (let x = info.x0; x <= info.x1; x += 3) { const i = (y * width + x) * 4; t++; if (Math.abs(da[i] - db[i]) > 30 || Math.abs(da[i + 1] - db[i + 1]) > 30 || Math.abs(da[i + 2] - db[i + 2]) > 30) d++; }
  return d / t;
}

// ★接続確認を先にやって落とす。これが無いと端末が offline のとき例外を握り潰して黙って回り続け、
//   オーナーが都市をタップし続けても1枚も撮れない（実際にこれで2回無駄撃ちした）。
const devs = adb(["devices"]).stdout.toString().trim().split(/\r?\n/).slice(1).filter((l) => l.trim());
const ready = devs.filter((l) => /\bdevice\b\s*(transport_id|$)/.test(l));
if (!devs.length) { console.error("端末が接続されていません。USBを挿し直してください。"); process.exit(1); }
if (!ready.length) {
  console.error(`端末が使えません:\n  ${devs.join("\n  ")}\n\n"offline" ならUSBを挿し直す、"unauthorized" ならスマホ側のUSBデバッグ許可ダイアログでOKしてください。`);
  console.error(`復旧を試すなら: ${ADB} reconnect offline  （ダメなら ${ADB} kill-server → 挿し直し）`);
  process.exit(1);
}
const sz = adb(["shell", "wm", "size"]).stdout.toString(); const mm = sz.match(/(\d+)\s*x\s*(\d+)/);
if (!mm) { console.error(`画面サイズを取得できません（adb shell wm size → "${sz.trim()}"）。接続を確認してください。`); process.exit(1); }
console.log(`画面 ${mm[1]}x${mm[2]} / out=${outDir}`);
console.log("ウォッチ開始。郊外マップで都市をタップしてください。カードを検知したら自動保存します。終了は Ctrl+C。");
console.log("※ カードを出したら1秒ほど置いてから次をタップしてください。\n");

let saved = 0, lastSaved = null, prev = null, failStreak = 0;
while (saved < MAXSAVE) {
  let img;
  // ★撮影が続けて失敗したら黙らずに知らせる（接続断に気づかないまま延々タップさせないため）
  try { img = capRaw(); failStreak = 0; }
  catch (e) {
    if (++failStreak === 5) console.error(`[!] 画面キャプチャに5回連続で失敗（${e.message}）。端末の接続が切れていませんか？`);
    if (failStreak >= 30) { console.error("[!] 30回連続で失敗したので終了します。USBを挿し直して再実行してください。"); process.exit(1); }
    await sleep(POLL); continue;
  }
  const info = cardInfo(img);
  if (!isCard(info)) { prev = null; await sleep(POLL); continue; }
  if (hudBrightness(img) < DIM_MIN) { prev = null; await sleep(POLL); continue; }   // 暗転＝モーダルダイアログ
  if (lastSaved && diffRegion(lastSaved, img, info) < 0.05) { await sleep(POLL); continue; }  // 保存済みと同じカード
  // 表示途中（スライドイン）を掴まないよう、直前フレームとカード領域が一致していることだけ確認する。
  if (diffRegion(prev, img, info) > 0.02) { prev = img; await sleep(150); continue; }

  const buf = capPng();                       // 保存用に1枚だけPNGで撮り直す
  const pimg = toImg(buf);
  const pinfo = cardInfo(pimg);
  if (!isCard(pinfo)) { prev = null; continue; }   // 撮り直しの間にカードが閉じた
  saved++; const file = path.join(outDir, `card_${String(startNo + saved).padStart(3, "0")}.png`);
  fs.writeFileSync(file, buf); lastSaved = pimg; prev = pimg;
  console.log(`  saved ${path.basename(file)}  (杖${pinfo.wand}px ボタン行${pinfo.rows}本 / カード x=${pinfo.x0}〜${pinfo.x1})  計${saved}枚`);
}
console.log(`\n完了: ${saved}枚 → ${path.resolve(outDir)}。チャットに「done cards」と伝えてください。`);
