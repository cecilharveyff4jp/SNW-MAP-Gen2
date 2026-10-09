#!/usr/bin/env node
// 保守用PC用：adb（USB/scrcpyのまま可）で同盟ランキング(総力)を自動スクロール連続キャプチャ。
//
// 重要な設計事情:
//   ・自分の順位行（例: セシル19位）は常に画面最下部に固定表示され、リストの末尾1〜2行を隠す。
//   ・1スワイプで1画面ぶんスクロールすると、その隠れた行がどの静止画にも残らず「飛ぶ」。
//   → 対策: 1スワイプを1画面未満に抑えて必ず重複させる。重複は後段(順位)で名寄せ除去する。
//   → 最下部に到達したら（画面が変化しなくなったら）自動停止するので、--count は多めでOK。
//
// 使い方:
//   $env:ADB="D:\\...\\adb.exe"
//   node tools\capture-ranking.mjs --count 45 --out tools\shots
//   調整: --swipe x1,y1,x2,y2  --dur 700  --settle 450  --serial <dev>  --connect IP:PORT  --diff-stop 0.01

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PNG } from "pngjs";

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }

const ADB = arg("--adb", process.env.ADB || "adb");
const serial = arg("--serial");
const count = Number(arg("--count", "22")); // 1枚≈5.3行 × 22枚 ≈ 116行ぶん → 最大100名を余裕でカバー
let swipe = arg("--swipe", null);
const outDir = arg("--out", "tools/shots"); // 既定は元の tools/shots（リポジトリ直下で実行する前提）
const settle = Number(arg("--settle", "300"));
const dur = arg("--dur", "600");
const connectTo = arg("--connect");

const base = serial ? ["-s", serial] : [];
function adb(args) {
  const r = spawnSync(ADB, [...base, ...args], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`adb 実行失敗: ${r.error.message}\n  adb が見つかりません。$env:ADB="C:\\...\\adb.exe" で指定してください。`);
  return r;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (connectTo) process.stdout.write(adb(["connect", connectTo]).stdout.toString());

const dev = adb(["devices"]).stdout.toString();
console.log(dev.trim());
if (!/\bdevice\b/.test(dev.split("\n").slice(1).join("\n"))) {
  console.error("接続済みデバイスが見つかりません。USB/scrcpy 接続を確認してください。");
  process.exit(1);
}

// 1画面未満の小さめスワイプを自動計算（隠れ行を次画面で必ず拾う）
if (!swipe) {
  const sizeOut = adb(["shell", "wm", "size"]).stdout.toString();
  const m = sizeOut.match(/(\d+)\s*x\s*(\d+)/);
  if (m) {
    const W = +m[1], H = +m[2], cx = Math.round(W / 2);
    swipe = `${cx},${Math.round(H * 0.60)},${cx},${Math.round(H * 0.36)}`; // ≈0.24H ＝1枚あたり約5〜6行（取りこぼさず高速）
    console.log(`画面サイズ ${W}x${H} → 自動スワイプ ${swipe} (dur=${dur}ms, settle=${settle}ms)`);
  } else { swipe = "360,900,360,700"; console.log(`サイズ取得失敗。既定スワイプ ${swipe}`); }
}

fs.mkdirSync(outDir, { recursive: true });
let removed = 0;
for (const f of fs.readdirSync(outDir)) { if (/^rank_\d+\.png$/i.test(f)) { fs.rmSync(path.join(outDir, f)); removed++; } }
if (removed) console.log(`旧キャプチャ ${removed} 枚を削除`);

// --- 最下部検知: リスト領域のサンプル点で「色差>30の画素の割合」を見る（capture-all.mjs と同じ実装）---
//
// ★バイト一致(Buffer.equals)で判定してはいけない。
//   行のアバターが常時アニメーションしているので、最下部で止まっていても PNG は毎回変わる。
//   実測(2026-07-28): 15枚目で最下部に着いたのに停止せず、--count 45 を撮り切って30枚がムダになった。
//   一方この割合方式なら「スクロール中 ≒ 0.4」「最下部 ≒ 0.00」と桁で離れるので閾値0.01で確実に切れる。
const DIFF_STOP = Number(arg("--diff-stop", "0.01"));
function diffFrac(a, b) {
  const pa = PNG.sync.read(a), pb = PNG.sync.read(b);
  if (pa.width !== pb.width || pa.height !== pb.height) return 1;
  const { width, height, data: da } = pa, db = pb.data;
  let diff = 0, tot = 0;
  const y0 = Math.round(height * 0.19), y1 = Math.round(height * 0.90);
  for (let y = y0; y < y1; y += 12) for (let x = 30; x < width - 30; x += 12) {
    const i = (y * width + x) * 4; tot++;
    if (Math.abs(da[i] - db[i]) > 30 || Math.abs(da[i + 1] - db[i + 1]) > 30 || Math.abs(da[i + 2] - db[i + 2]) > 30) diff++;
  }
  return tot ? diff / tot : 1;
}

const [x1, y1, x2, y2] = swipe.split(",").map((s) => s.trim());
let prev = null, saved = 0;
for (let i = 0; i < count; i++) {
  const shot = adb(["exec-out", "screencap", "-p"]);
  if (!shot.stdout || shot.stdout.length < 1000) { console.error(`キャプチャ失敗: ${shot.stderr?.toString?.() ?? ""}`); process.exit(1); }
  if (prev) {
    const d = diffFrac(shot.stdout, prev);
    if (d < DIFF_STOP) { console.log(`最下部に到達（前画面との差 ${(d * 100).toFixed(2)}% < ${(DIFF_STOP * 100).toFixed(0)}%）。${saved}枚で終了。`); break; }
  }
  saved++;
  const file = path.join(outDir, `rank_${String(saved).padStart(2, "0")}.png`);
  fs.writeFileSync(file, shot.stdout);
  console.log(`saved ${file} (${shot.stdout.length} bytes)`);
  prev = shot.stdout;
  adb(["shell", "input", "swipe", x1, y1, x2, y2, String(dur)]);
  await sleep(settle);
}
console.log(`\n完了: ${saved}枚を ${path.resolve(outDir)} に保存。`);
console.log(`「done」と伝えてくれれば全部読み取って名寄せ→ranking.jsonにします。`);
