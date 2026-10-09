#!/usr/bin/env node
// 【監視モード：倉庫報酬】都市（ホーム）画面を常駐監視し、倉庫の上に出るバブルを検知したら
//   自動でタップして回収する。終了は Ctrl+C。依存: pngjs（tools/package.json）。要 $env:ADB。
//   対象は2種類:
//     ・宝箱               … 約10分ごと。1タップで回収。
//     ・缶詰(大盤振る舞い) … 毎日9時と21時、期限12時間。アイコン→ダイアログの緑「受取」の2タップ。
//                            受取を押すとダイアログは自分で閉じる（実測）。
//
//   使い方:
//     . tools\adb-env.ps1                     # 先に接続情報を環境変数へ
//     node tools\watch-warehouse.mjs          # 常駐・検知したらタップ
//     node tools\watch-warehouse.mjs --dry    # タップせず検知だけ（較正・動作確認用）
//     node tools\watch-warehouse.mjs --interval 10 --shots tools\shots\wh   # 間隔と証跡PNGの保存先
//
//   ★Wi-Fi で回すとき: 画面の取得方式は --cap auto（既定）が接続の種類で選ぶ。
//     USB→raw（速い） / Wi-Fi→png。実測（都市画面 720x1612）: raw 4.43MiB/2430ms、png 1295KB/1621ms。
//     転送量が約3.5分の1になる。回線が荒れているときの差はもっと大きく、raw は1枚54秒かけた末に接続断になった。
//     明示指定は --cap raw|png。転送が詰まったときの打ち切りは --cap-timeout 秒（既定15）。
//
//   監視のリズム: 起動直後は起点が無いので通常監視（既定20秒間隔）。1個回収するとそこから逆算して
//   次の出現時刻まで**アイドル**（画面を撮らない）→ 出現の30秒前から3秒間隔の高速監視で即回収。
//   周期は回収のたびに実測で更新する（初期見積り10分）。逆算を使わず常に定間隔で回すなら --no-schedule。
//
//   前提: ゲームを**都市（ホーム）画面**にしたまま放置すること。倉庫が画面内に入っていること。
//         scrcpy は --stay-awake で起動しておく（画面が消えると adb 接続ごと落ちる）。
//
//   ★カメラは自由に動かせるので位置決め打ちにはしない。画面全体から宝箱バブルを色で探す。

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function arg(n, d) { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; }
const has = (n) => process.argv.includes(n);
const ADB = arg("--adb", process.env.ADB || "adb");
const serial = arg("--serial", process.env.ANDROID_SERIAL);
const base = serial ? ["-s", serial] : [];
const IS_WIFI = /^\d{1,3}(?:\.\d{1,3}){3}:\d{2,5}$/.test(serial || "");   // シリアルが IP:PORT なら Wi-Fi 接続

// ★タイムアウト必須。Wi-Fi が詰まると adb は返ってこない（実測: raw 1枚で54秒かかった末に接続断）。
//   無人監視なので、固まるくらいなら打ち切って次の周回に回す方がよい。
const CAP_TIMEOUT = Math.max(3, Number(arg("--cap-timeout", "15"))) * 1000;
function adb(a, timeout = CAP_TIMEOUT) {
  const r = spawnSync(ADB, [...base, ...a], { encoding: "buffer", maxBuffer: 128 * 1024 * 1024, timeout });
  if (r.error) {
    const why = r.error.code === "ETIMEDOUT" ? `${timeout / 1000}秒でタイムアウト（回線が遅い/切れている）` : r.error.message;
    throw new Error(`adb失敗: ${why}（$env:ADBでadb.exe指定）`);
  }
  return r;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toLocaleString("ja-JP", { hour12: false });
const hhmmss = (ms) => new Date(ms).toLocaleTimeString("ja-JP", { hour12: false });

const DRY = has("--dry");
const INTERVAL = Math.max(2, Number(arg("--interval", "20"))) * 1000;  // 監視間隔（秒指定）
const COOLDOWN = Math.max(0, Number(arg("--cooldown", "60"))) * 1000;  // 回収後に監視を休む時間
const SHOTS = arg("--shots", "");            // 指定時、検知したフレームをPNGで残す
const LOGFILE = arg("--log", "");            // 指定時、1行ログを追記
const NO_BACK = has("--no-back");            // タップ後にダイアログが出ても BACK を押さない
const MAXCLAIM = Number(arg("--max", "0"));  // >0 なら この回数回収したら終了

// ── 逆算スケジュール ──────────────────────────────────────────────────────
// 倉庫は回収するとカウントダウンが始まり、一定周期で次の宝箱が出る（実測 約10分）。
// つまり回収した瞬間から次の出現時刻は計算できるので、その手前までは**画面を撮らない**（アイドル）。
// 出現の少し前から高速監視に切り替えて、出た直後に取る。起動直後だけは起点が無いので通常監視で1個拾う。
const CYCLE0 = Math.max(60, Number(arg("--cycle", "600"))) * 1000;    // 周期の初期見積り（秒）。実測で上書きされる
const LEAD = Math.max(5, Number(arg("--lead", "30"))) * 1000;         // 見込み時刻の何秒前から高速監視に入るか
const FAST = Math.max(1, Number(arg("--fast", "3"))) * 1000;          // 高速監視の間隔
const GIVEUP = Math.max(30, Number(arg("--max-wait", "300"))) * 1000; // 見込みを過ぎてこの時間出なければ通常監視へ戻す
const NO_SCHEDULE = has("--no-schedule");    // 逆算せず常に --interval で回る（従来動作）

// 缶詰（大盤振る舞い）は毎日9時と21時に出て、受け取り期限は12時間。宝箱待ちのアイドル中でも
// この時刻には必ず起きて取りに行く。取り逃しても期限が長いので、以後の通常/高速監視で拾える。
const CAN_HOURS = String(arg("--can-hours", "9,21")).split(",").map(Number).filter((h) => h >= 0 && h < 24).sort((a, b) => a - b);
const CAN_WINDOW = Math.max(30, Number(arg("--can-window", "300"))) * 1000;  // 出現時刻から何秒間、高速で探すか
function nextCanTime(from) {
  for (let d = 0; d <= 1; d++) for (const h of CAN_HOURS) {
    const t = new Date(from); t.setDate(t.getDate() + d); t.setHours(h, 0, 0, 0);
    if (t.getTime() > from) return t.getTime();
  }
  return from + 12 * 3600_000;
}

if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
function log(msg) {
  const line = `[${stamp()}] ${msg}`;
  console.log(line);
  if (LOGFILE) { try { fs.appendFileSync(LOGFILE, line + "\n"); } catch { /* ログ失敗で監視は止めない */ } }
}

// ── 画面取得 ──────────────────────────────────────────────────────────────
// 監視は raw（端末側のPNG圧縮を省くぶん速い）。raw の先頭は width,height,format の uint32 が並び、
// ヘッダ長は機種で12/16があるので実測で判定する（capture-cards.mjs と同じ）。
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

// ★Wi-Fi では raw を使わない。720x1612 の raw は 4.43MiB あり、荒れた回線では1枚54秒かけた末に接続断になった。
//   PNG なら同じ都市画面が 1295KB（約3.5分の1）。健全な回線での実測でも raw 2430ms に対し png 1621ms と速い。
//   ★注意: 設定画面のような平坦な画面だと PNG は約140KB まで落ちるが、監視対象の都市画面は
//     絵が細かいので 1.3MB 前後になる。「PNGは140KB」と覚えると見積りを4倍間違える。
//   検知ロジックが見るのは {width,height,data} の RGBA だけなので、raw と PNG は差し替え可能
//   （--test-png の較正経路が最初から PNG を同じ形で食わせている）。
const CAPMODE_ARG = String(arg("--cap", "auto")).toLowerCase();
if (!["auto", "raw", "png"].includes(CAPMODE_ARG)) {
  console.error(`--cap は auto / raw / png のいずれかです: ${CAPMODE_ARG}`);
  process.exit(1);
}
// auto: Wi-Fi(IP:PORT) なら png、USB なら raw。
const CAPMODE = CAPMODE_ARG === "auto" ? (IS_WIFI ? "png" : "raw") : CAPMODE_ARG;

// pngjs は PNG を使うときだけ読む（--test-png も同じものを使い回す）。
const PNG = (CAPMODE === "png" || arg("--test-png")) ? (await import("pngjs")).PNG : null;
function capPngImg() {
  const p = PNG.sync.read(capPng());
  return { width: p.width, height: p.height, data: p.data };
}
const cap = CAPMODE === "png" ? capPngImg : capRaw;

// ── 連続失敗時の自動復旧 ──────────────────────────────────────────────────
// 無人で何時間も回すので、切れたまま20回失敗して終了…では取り逃す。手作業で効いた復旧手順を仕込む。
//   3回目 … adb reconnect（offline に落ちただけならこれで戻る）
//   6回目以降（6の倍数）… Wi-Fi なら adb connect <serial> で繋ぎ直す（ポートが同じうちは有効）
// ★-s を付けずに叩く必要があるコマンドがあるので base は使わない。復旧の失敗で監視は止めない。
function adbBare(a) {
  try { return spawnSync(ADB, a, { encoding: "utf8", timeout: 15000 }); } catch { return null; }
}
function tryRecover(streak) {
  if (streak === 3) {
    log("　[復旧] adb reconnect を試みます。");
    adbBare(["reconnect"]);
  } else if (streak >= 6 && streak % 6 === 0 && IS_WIFI) {
    log(`　[復旧] adb connect ${serial} で繋ぎ直します。`);
    adbBare(["disconnect", serial]);
    const r = adbBare(["connect", serial]);
    const msg = (r?.stdout || r?.stderr || "").trim().split(/\r?\n/).pop();
    if (msg) log(`　[復旧] ${msg}`);
  }
}

// ── 宝箱バブルの検知 ──────────────────────────────────────────────────────
// 手掛かりは3つ。実測較正（720x1612 / 都市画面）:
//   宝箱バブル      … 木部1137px / タン  62px / 白0.395
//   地図バブル(探検) … 木部 443px / タン1493px / 白0.521  ← 白バブルなので白だけでは分離できない
//   マップの木製建物・橋 … 木部 772px / タン   0px / 白0.002  ← 白で落ちる
//
//   ①宝箱の木部（濃い茶）の塊があること           … 主判定
//   ②塊の周りが白いこと（＝吹き出しの中身である）   … マップの木の建物・橋を除外
//   ③明るいタン（羊皮紙）が木部より多くないこと     … 探検の地図バブルを除外（ここが決め手）
//
//   ★位置もズームも決め打ちしない。実測（元画像を平行移動/拡大縮小して検証）:
//     平行移動 … 木部1137px・白0.395 のまま（当然だが箱の測り方を誤ると崩れる。下の注記参照）
//     ズーム0.5〜1.3倍 … 木部281〜1901px と大きく変わるが、白率は0.389〜0.407でほぼ不変。
//     だから「大きさ」は緩く（--min-wood 180）、「白率」を主判定にしている。
const isWood = (r, g, b) => r >= 120 && r <= 205 && g >= 60 && g <= 135 && b >= 15 && b <= 85 && r - g >= 40 && g - b >= 25;
const isTan  = (r, g, b) => r >= 205 && g >= 145 && g <= 220 && b >= 60 && b <= 140 && r - g >= 25;
const isWhite = (r, g, b) => r >= 228 && g >= 228 && b >= 215 && Math.max(r, g, b) - Math.min(r, g, b) <= 30;
// 缶詰（大盤振る舞い）の暗いオレンジ。実測 (173,74,0)(141,55,0)(113,44,5)(110,46,9) …
// ★宝箱の木部と分けるのは **b（青）**。実測 缶詰 b=0〜9 / 宝箱 b=39〜54、g も 44〜74 対 93〜110 と離れている。
//   最初 b<=48 で書いたら宝箱の影を缶詰と誤判定した（宝箱バブルで芯367px を拾ってしまった）。
const isCan = (r, g, b) => r >= 100 && r <= 195 && g >= 35 && g <= 85 && b <= 20 && r - g >= 60 && g - b >= 30;

const MIN_WOOD = Number(arg("--min-wood", "180"));    // 等倍1137px。引きの画（0.5倍）でも281pxあるので低めに置く
const MIN_WHITE = Number(arg("--min-white", "0.28")); // 宝箱の周りの白率。実測は等倍0.395〜0.5倍0.407でほぼ不変
const TAN_RATIO = Number(arg("--tan-ratio", "0.6"));  // タン/木部 がこれ以上なら地図バブルとみなす
const CELL = 16;
const DEBUG = has("--debug");   // 候補ごとの実測値を出す（較正用）

// 監視対象。どちらも「白い吹き出しの中に、その報酬らしい色の塊がある」で見つける。
const MIN_CAN = Number(arg("--min-can", "120"));   // 実測 約350px（等倍）
// padF/annulus …「周りの白さ」をどの距離で測るか。★缶詰はアイコンが吹き出しいっぱいに描かれていて、
//   宝箱と同じ狭い余白(0.22)だと白が見えない（実測 白0.048 で検知できず）。距離を離して輪だけ見る。
//   実測（缶詰バブル）: 余白x0.22→0.069 / x0.40→0.254 / x0.60→0.360 / x0.80→0.370 / x1.20→0.269
//   参考にダイアログ内の缶アイコン（青タイルの上）は同じ測り方で0.010〜0.034なので誤検知しない。
const TARGETS = [
  // 缶詰を先に見る。宝箱は10分ごとに来るが、缶詰は9時/21時の1日2回なので取りこぼしたくない。
  { key: "can",   name: "缶詰(大盤振る舞い)", core: isCan,  min: MIN_CAN,  tanReject: false, twoTap: true,  padF: 0.70, annulus: true },
  { key: "chest", name: "宝箱",              core: isWood, min: MIN_WOOD, tanReject: true,  twoTap: false, padF: 0.22, annulus: false },
];

function findBubble(img, T) {
  const { width, height, data } = img;
  // 上端HUD(〜9%)と下端のタブバー/チャット(〜85%より下)は監視対象外。バッグ等の茶色アイコンを拾わない。
  const yTop = Math.round(height * 0.09), yBot = Math.round(height * 0.85);

  const cells = new Map();
  for (let y = yTop; y < yBot; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = row + x * 4;
      if (T.core(data[i], data[i + 1], data[i + 2])) {
        const k = ((y / CELL) | 0) * 10000 + ((x / CELL) | 0);
        cells.set(k, (cells.get(k) || 0) + 1);
      }
    }
  }
  // 8近傍で連結（粗いセル単位）
  const seen = new Set(), clusters = [];
  for (const k0 of cells.keys()) {
    if (seen.has(k0)) continue;
    seen.add(k0);
    const stack = [k0], mem = [];
    while (stack.length) {
      const cur = stack.pop(); mem.push(cur);
      const cy = (cur / 10000) | 0, cx = cur % 10000;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nk = (cy + dy) * 10000 + (cx + dx);
        if (cells.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(nk); }
      }
    }
    // ★セル単位の箱をそのまま使うと、同じ絵でもグリッドの切れ目次第で箱が最大15px膨らみ、
    //   周囲の白率が 0.51→0.30 まで振れる（ドラッグでずらしただけの画像を取りこぼした）。
    //   セルは連結を取るためだけに使い、範囲は目印ピクセルの実位置で測り直す。
    let n = 0, cx0 = 1e9, cy0 = 1e9, cx1 = -1, cy1 = -1;
    for (const m of mem) {
      const cy = (m / 10000) | 0, cx = m % 10000;
      n += cells.get(m);
      cx0 = Math.min(cx0, cx * CELL); cy0 = Math.min(cy0, cy * CELL);
      cx1 = Math.max(cx1, cx * CELL + CELL - 1); cy1 = Math.max(cy1, cy * CELL + CELL - 1);
    }
    cx1 = Math.min(cx1, width - 1); cy1 = Math.min(cy1, height - 1);
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) {
      const i = (y * width + x) * 4;
      if (T.core(data[i], data[i + 1], data[i + 2])) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) continue;
    clusters.push({ n, x0, y0, x1, y1 });
  }
  clusters.sort((a, b) => b.n - a.n);

  for (const c of clusters) {
    if (c.n < T.min) break;                          // 以降は更に小さいので打ち切り
    const w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1;
    if (w < 18 || h < 14 || w > 220 || h > 220) continue;   // 実測 宝箱 等倍78x60 / 0.5倍39x30、缶詰 36x26
    // 白さは「目印の周り」で測る。★余白を固定pxにするとズームで壊れるので大きさに比例させる。
    const pad = Math.max(6, Math.round(Math.max(w, h) * T.padF));
    const ax0 = Math.max(0, c.x0 - pad), ax1 = Math.min(width - 1, c.x1 + pad);
    const ay0 = Math.max(0, c.y0 - pad), ay1 = Math.min(height - 1, c.y1 + pad);
    let wh = 0, t = 0, tan = 0;
    for (let y = ay0; y <= ay1; y++) for (let x = ax0; x <= ax1; x++) {
      const i = (y * width + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
      if (isTan(r, g, b)) tan++;
      if (T.annulus && x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1) continue;  // 輪だけ見る
      if (T.core(r, g, b)) continue;                 // 目印そのものは母数から除く
      t++;
      if (isWhite(r, g, b)) wh++;
    }
    const white = t ? wh / t : 0;
    if (DEBUG) console.log(`  候補[${T.key}] 芯${String(c.n).padStart(5)} box=(${c.x0},${c.y0})-(${c.x1},${c.y1}) ${w}x${h} 白${white.toFixed(3)} タン${tan}`);
    if (white < MIN_WHITE) continue;                 // 吹き出しの白地に載っていない＝マップ上の木の建物など
    if (T.tanReject && tan >= c.n * TAN_RATIO) continue;   // 羊皮紙優勢＝探検の地図バブル
    return { target: T, x: Math.round((c.x0 + c.x1) / 2), y: Math.round((c.y0 + c.y1) / 2), core: c.n, tan, white, box: c };
  }
  return null;
}

// 監視対象を優先順に探す（缶詰 → 宝箱）
function findAny(img) {
  for (const T of TARGETS) { const hit = findBubble(img, T); if (hit) return hit; }
  return null;
}

// 緑の「受取」ボタンを探す。実測 (32,176,80) の塊が14085px、画面全体の91.7%がここに集中する。
// ★位置は決め打ちしない（ダイアログの高さは報酬の数で変わる）。
const isGreenBtn = (r, g, b) => Math.abs(r - 40) <= 34 && Math.abs(g - 176) <= 40 && Math.abs(b - 82) <= 36 && g - r >= 90 && g - b >= 60;
function findGreenButton(img) {
  const { width, height, data } = img;
  let best = null, cur = null;
  for (let y = Math.round(height * 0.2); y < Math.round(height * 0.95); y++) {
    let n = 0, x0 = width, x1 = -1;
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = row + x * 4;
      if (isGreenBtn(data[i], data[i + 1], data[i + 2])) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; }
    }
    if (n >= width * 0.15) {                        // ボタン幅は画面の3割ほど。細い緑の装飾は拾わない
      if (!cur) cur = { y0: y, y1: y, n: 0, x0, x1 };
      cur.y1 = y; cur.n += n; cur.x0 = Math.min(cur.x0, x0); cur.x1 = Math.max(cur.x1, x1);
    } else if (cur) { if (!best || cur.n > best.n) best = cur; cur = null; }
  }
  if (cur && (!best || cur.n > best.n)) best = cur;
  if (!best || best.y1 - best.y0 < 20) return null;
  return { x: Math.round((best.x0 + best.x1) / 2), y: Math.round((best.y0 + best.y1) / 2), n: best.n };
}

// タップ後にモーダルが出たかの判定。ダイアログは画面全体を暗転させるので上端HUDの明るさで分かる
// （capture-cards.mjs の実測: ダイアログ29 / 通常117〜125）。
function hudBrightness(img) {
  const { width, height, data } = img;
  let s = 0, n = 0;
  for (let y = Math.round(height * 0.02); y < Math.round(height * 0.09); y += 2)
    for (let x = 0; x < width; x += 2) { const k = (y * width + x) * 4; s += (data[k] + data[k + 1] + data[k + 2]) / 3; n++; }
  return s / n;
}
const DIM_MIN = Number(arg("--dim-min", "70"));

// ── 較正用: PNGを1枚渡して検知結果だけ見る（端末不要）────────────────────────────
//   例: node tools\watch-warehouse.mjs --test-png tools\shots\wh\wh_xxx.png
//   位置をずらした/縮小した画像でも見つかるか、を確かめるのに使う。
if (arg("--test-png")) {
  const p = PNG.sync.read(fs.readFileSync(arg("--test-png")));
  const img = { width: p.width, height: p.height, data: p.data };
  const hit = findAny(img);
  const btn = findGreenButton(img);
  console.log(hit
    ? `検知[${hit.target.key}] ${hit.target.name} x=${hit.x} y=${hit.y} 芯${hit.core}px 白${hit.white.toFixed(2)} タン${hit.tan} box=(${hit.box.x0},${hit.box.y0})-(${hit.box.x1},${hit.box.y1})`
    : "検知なし");
  if (btn) console.log(`緑ボタン: x=${btn.x} y=${btn.y}（${btn.n}px）`);
  process.exit(hit ? 0 : 2);
}

// ── 接続確認（capture-cards.mjs と同じ。offline のまま黙って回り続けるのを防ぐ）──────────
const devs = adb(["devices"]).stdout.toString().trim().split(/\r?\n/).slice(1).filter((l) => l.trim());
const ready = devs.filter((l) => /\bdevice\b\s*(transport_id|$)/.test(l));
if (!devs.length) { console.error("端末が接続されていません。node tools\\connect-wifi.mjs --auto で繋いでください。"); process.exit(1); }
if (!ready.length) {
  console.error(`端末が使えません:\n  ${devs.join("\n  ")}\n\n復旧: ${ADB} reconnect offline （ダメなら connect-wifi.mjs で繋ぎ直し）`);
  process.exit(1);
}
const sz = adb(["shell", "wm", "size"]).stdout.toString(); const mm = sz.match(/(\d+)\s*x\s*(\d+)/);
if (!mm) { console.error(`画面サイズを取得できません（adb shell wm size → "${sz.trim()}"）。`); process.exit(1); }

log(`監視開始 ${mm[1]}x${mm[2]} / 通常${INTERVAL / 1000}秒間隔` +
    (NO_SCHEDULE ? "（逆算なし）" : ` / 回収後は逆算して${LEAD / 1000}秒前から${FAST / 1000}秒間隔`) +
    ` / ${DRY ? "★DRY（タップしません）" : "検知したらタップします"}`);
log(`　接続: ${serial || "(既定)"} [${IS_WIFI ? "Wi-Fi" : "USB"}] / 取得方式: ${CAPMODE}` +
    (CAPMODE_ARG === "auto" ? "（auto）" : "") +
    ` / タイムアウト${CAP_TIMEOUT / 1000}秒` +
    (CAPMODE === "raw" && IS_WIFI ? "  ★Wi-Fiでrawは重すぎます（--cap png 推奨）" : ""));
console.log("　都市（ホーム）画面のまま放置してください。倉庫が画面内に入っている必要があります。終了は Ctrl+C。");

let claims = 0, checks = 0, failStreak = 0, lastSeen = "";
let cycle = CYCLE0;        // 学習した宝箱の周期
let nextAt = null;         // 次に宝箱が出ると見込む時刻。null なら通常監視
let prevClaimAt = null;    // 直前の回収時刻（周期の実測に使う）
let idleLogged = false;
let canAt = nextCanTime(Date.now());   // 次の大盤振る舞い（9時/21時）
log(`　監視対象: ${TARGETS.map((t) => t.name).join(" / ")}。次の大盤振る舞いは ${hhmmss(canAt)} 頃。\n`);
process.on("SIGINT", () => { log(`終了。監視${checks}回 / 回収${claims}回`); process.exit(0); });

while (true) {
  // 缶詰の出現時刻を過ぎて見つからなかった場合は次の回へ送る（期限12時間なので取り逃しではない）
  if (Date.now() >= canAt + CAN_WINDOW) {
    canAt = nextCanTime(Date.now());
    log(`大盤振る舞いは出現時刻に見つかりませんでした。次は ${hhmmss(canAt)} 頃（それまでも通常監視で探します）。`);
  }
  const inCanWindow = Date.now() >= canAt;      // 9時/21時の直後は宝箱のアイドルより優先して見る

  // ── アイドル：次の出現が読めているなら、その手前まで画面を撮らない ──────────────
  const scheduled = nextAt && !NO_SCHEDULE;
  if (scheduled && !inCanWindow) {
    const wake = Math.min(nextAt - LEAD, canAt);   // 宝箱の少し前か、缶詰の時刻か、早い方で起きる
    const wait = wake - Date.now();
    if (wait > 0) {
      if (!idleLogged) {
        log(`次は ${hhmmss(nextAt)} 頃の見込み（周期${Math.round(cycle / 1000)}秒）。それまで待機します。` +
            (wake < nextAt - LEAD ? `（${hhmmss(canAt)} の大盤振る舞いで一度起きます）` : ""));
        idleLogged = true;
      }
      await sleep(Math.min(wait, 60_000));   // 60秒ずつ刻む（Ctrl+C の反応を鈍らせない）
      continue;
    }
    // 見込みを大きく過ぎても出ない＝手で回収された/周期が違う。通常監視へ戻す。
    if (Date.now() > nextAt + GIVEUP) {
      log(`見込み時刻から${GIVEUP / 1000}秒過ぎても出ないので、通常監視（${INTERVAL / 1000}秒間隔）に戻します。`);
      nextAt = null; prevClaimAt = null; continue;
    }
  }
  const pollMs = (scheduled || inCanWindow) ? FAST : INTERVAL;

  let img;
  try { img = cap(); failStreak = 0; }
  catch (e) {
    if (++failStreak === 3) log(`[!] 画面キャプチャに3回連続で失敗（${e.message}）。接続が切れていませんか？`);
    tryRecover(failStreak);
    if (failStreak >= 20) { log("[!] 20回連続で失敗したので終了します。connect-wifi.mjs で繋ぎ直してください。"); process.exit(1); }
    await sleep(pollMs); continue;
  }
  checks++;

  if (hudBrightness(img) < DIM_MIN) { await sleep(pollMs); continue; }   // 暗転＝ダイアログ等が開いている
  const hit = findAny(img);
  if (!hit) { await sleep(pollMs); continue; }
  const T = hit.target;
  const detectedAt = Date.now();
  const wasFast = !!scheduled;

  // ★誤タップ防止：バブルは上下に揺れるアニメなので、少し置いて2フレーム連続で
  //   ほぼ同じ位置に見えることを確認してからタップする。
  await sleep(700);
  let img2, hit2 = null;
  try { img2 = cap(); hit2 = findBubble(img2, T); } catch { /* 次周回で再判定 */ }
  if (!hit2 || Math.abs(hit2.x - hit.x) > 40 || Math.abs(hit2.y - hit.y) > 40) {
    log(`${T.name}を検知したが再確認で外れた（1回目 x=${hit.x},y=${hit.y}）。見送ります。`);
    await sleep(pollMs); continue;
  }

  const where = `x=${hit2.x},y=${hit2.y} 芯${hit2.core}px 白${hit2.white.toFixed(2)} タン${hit2.tan}`;
  if (SHOTS) {
    try { fs.writeFileSync(path.join(SHOTS, `${T.key}_${Date.now()}.png`), capPng()); } catch { /* 証跡が撮れなくても続行 */ }
  }
  if (DRY) {
    if (where !== lastSeen) { log(`${T.name}を検知（DRYのためタップしません） ${where}`); lastSeen = where; }
    await sleep(pollMs); continue;
  }

  log(`${T.name}を検知 → タップ ${where}`);
  adb(["shell", "input", "tap", String(hit2.x), String(hit2.y)]);
  await sleep(1800);

  // ★缶詰（大盤振る舞い）は2タップ。アイコン→ダイアログの緑「受取」を押すまでが1回の回収。
  //   実測: 受取を押すとダイアログは自分で閉じて都市画面に戻る（BACKは不要）。
  let twoTapOk = true;
  if (T.twoTap) {
    let dlg = null;
    try { dlg = cap(); } catch { /* 次で判定 */ }
    const btn = dlg ? findGreenButton(dlg) : null;
    if (!btn) {
      twoTapOk = false;
      log("　[!] 受取ボタン（緑）が見つかりません。ダイアログを閉じて次の周回に回します。");
      if (!NO_BACK) { adb(["shell", "input", "keyevent", "4"]); await sleep(1000); }
    } else {
      log(`　受取ボタンをタップ x=${btn.x},y=${btn.y}（緑${btn.n}px）`);
      adb(["shell", "input", "tap", String(btn.x), String(btn.y)]);
      await sleep(2000);
    }
  }

  // 後始末：報酬ダイアログが開いたままなら BACK で閉じる（ゲームのダイアログは戻るで閉じられる）
  let after = null;
  try { after = cap(); } catch { /* 次周回で確認 */ }
  if (after && hudBrightness(after) < DIM_MIN) {
    if (NO_BACK) log("　ダイアログが開いたままです（--no-back のため閉じません）。");
    else {
      adb(["shell", "input", "keyevent", "4"]);
      await sleep(1200);
      try { after = cap(); } catch { after = null; }
      if (after && hudBrightness(after) < DIM_MIN) log("　[!] BACKでもダイアログが閉じません。画面を確認してください。");
      else log("　ダイアログを閉じました。");
    }
  }

  // 回収できたか（バブルが消えたか）を確認する。消えていなければタップ位置がずれた可能性がある。
  if (!twoTapOk || (after && findBubble(after, T))) {
    log(`　[!] タップ後も${T.name}のバブルが残っています。倉庫以外を叩いた可能性があります。`);
    if (!T.twoTap) { nextAt = null; prevClaimAt = null; }   // 回収できていないので逆算の起点にしない
  } else if (T.twoTap) {
    claims++;
    canAt = nextCanTime(Date.now());                        // 次の9時/21時へ
    log(`　${T.name}を回収しました（通算${claims}回）。次の大盤振る舞いは ${hhmmss(canAt)} 頃。`);
  } else {
    claims++;
    const claimedAt = Date.now();
    // ★周期の学習は「高速監視で捕まえた回」だけ信用する。通常監視だと検知が最大 --interval 秒
    //   遅れるので、その遅れをそのまま周期として覚えると見込み時刻が毎回後ろへずれていく。
    if (prevClaimAt && wasFast) {
      const obs = detectedAt - prevClaimAt;
      if (obs > 60_000 && obs < 3 * 3600_000) {
        if (Math.abs(obs - cycle) > 5000) log(`　周期を実測で更新: ${Math.round(cycle / 1000)}秒 → ${Math.round(obs / 1000)}秒`);
        cycle = obs;
      }
    }
    prevClaimAt = claimedAt;
    nextAt = claimedAt + cycle;
    idleLogged = false;
    log(`　回収しました（通算${claims}回）。次は ${hhmmss(nextAt)} 頃の見込み。`);
  }

  if (MAXCLAIM > 0 && claims >= MAXCLAIM) { log(`--max ${MAXCLAIM} に達したので終了します。`); break; }
  if (!nextAt || NO_SCHEDULE) await sleep(COOLDOWN);   // 逆算が効いている間は待機側に任せる
}
