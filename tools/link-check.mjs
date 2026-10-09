#!/usr/bin/env node
// 【診断】今の接続で撮影・監視が回るかを10秒で判定する。端末の状態は一切変えない（読み取りのみ）。
//
//   node tools\link-check.mjs            # 既定（PNGのみ測る）
//   node tools\link-check.mjs --raw      # raw も測る ★遅い回線だと数十秒固まるので普段は不要
//   node tools\link-check.mjs --n 5      # 試行回数
//
// なぜ要るか:
//   Wi-Fi は「adb は繋がっているのに遅すぎて使い物にならない」という状態になる。接続の成否だけ見ていると
//   原因の切り分けに何十分もかかる（実際にかかった）。ここで見るのは1点だけ:
//     **画面を1枚取るのに何ms/何MB かかるか**。これがそのまま撮影・監視の1判定あたりのコストになる。
//
// 実測の基準値（A403SH 720x1612 / 2026-07-27）:
//   PNG 約140KB、raw 約4.64MB。USB なら raw でも一瞬。
//   混雑した2.4GHz では raw 1枚に54秒かかった末に接続が切れた（＝rawでの監視は成立しない）。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function arg(n, d) { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; }
const has = (n) => process.argv.includes(n);

const N = Math.max(1, Number(arg("--n", "3")));
const WITH_RAW = has("--raw");
const IPPORT = /^\d{1,3}(?:\.\d{1,3}){3}:\d{2,5}$/;

// 接続先は connect-wifi.mjs / wifi-gui.ps1 が書いた .adb-target を既定にする。
function loadTarget() {
  try { return JSON.parse(fs.readFileSync(path.join(HERE, ".adb-target"), "utf8")); } catch { return null; }
}
const saved = loadTarget();
const ADB = arg("--adb", process.env.ADB || saved?.adb || "adb");
let serial = arg("--serial", process.env.ANDROID_SERIAL || "");

function adb(a, timeout = 60000) {
  return spawnSync(ADB, a, { encoding: "buffer", maxBuffer: 128 * 1024 * 1024, timeout });
}
function adbText(a, timeout = 20000) {
  const r = adb(a, timeout);
  return { out: (r.stdout?.toString() || "").trim(), err: (r.stderr?.toString() || "").trim(), code: r.status, timedOut: r.error?.code === "ETIMEDOUT" };
}

const C = { ok: "\x1b[32m", ng: "\x1b[31m", warn: "\x1b[33m", dim: "\x1b[90m", b: "\x1b[1m", z: "\x1b[0m" };
const say = (s = "") => console.log(s);

// ── 対象を決める ──────────────────────────────────────────────────────────
const devLines = adbText(["devices"]).out.split(/\r?\n/).slice(1).map((l) => l.trim()).filter(Boolean);
const devs = devLines.map((l) => { const [s, st] = l.split(/\s+/); return { serial: s, state: st }; });
if (!devs.length) { say(`${C.ng}端末が接続されていません。${C.z}`); process.exit(1); }

if (!serial) {
  const ready = devs.filter((d) => d.state === "device");
  if (!ready.length) {
    say(`${C.ng}使える端末がありません:${C.z}`);
    for (const d of devs) say(`  ${d.serial}  ${d.state}`);
    process.exit(1);
  }
  // 保存済みターゲットが生きていればそれを、無ければ最初の1台。
  serial = ready.find((d) => d.serial === saved?.serial)?.serial || ready[0].serial;
}
const isWifi = IPPORT.test(serial);

say(`${C.b}リンク診断${C.z}`);
say(`  adb    : ${ADB}`);
say(`  接続先 : ${serial}  [${isWifi ? "Wi-Fi" : "USB"}]`);
const state = devs.find((d) => d.serial === serial)?.state;
if (state !== "device") { say(`  ${C.ng}状態が ${state} です。繋ぎ直してください。${C.z}`); process.exit(1); }

const size = adbText(["-s", serial, "shell", "wm", "size"]).out;
const m = size.match(/(\d+)\s*x\s*(\d+)/);
if (m) say(`  画面   : ${m[1]}x${m[2]}（raw は約${((+m[1] * +m[2] * 4) / 1048576).toFixed(2)}MB/枚）`);
say("");

// ── ping（Wi-Fi のときだけ）──────────────────────────────────────────────
// 遅延とロスは「画面が取れない」より前に出る症状なので先に見る。
let pingLoss = null, pingAvg = null;
if (isWifi) {
  const ip = serial.split(":")[0];
  const r = spawnSync("ping", ["-n", "5", ip], { encoding: "utf8", timeout: 30000 });
  const out = r.stdout || "";
  const loss = out.match(/\((\d+)%\s*(?:loss|の損失)\)/i) || out.match(/(\d+)%\s*(?:loss|の損失)/i);
  const avg = out.match(/(?:Average|平均)\s*=\s*(\d+)\s*ms/i);
  pingLoss = loss ? +loss[1] : null;
  pingAvg = avg ? +avg[1] : null;
  const tag = pingLoss === null ? `${C.warn}判定不能${C.z}`
    : pingLoss >= 20 ? `${C.ng}★ロスが大きい${C.z}`
    : pingAvg !== null && pingAvg >= 100 ? `${C.warn}遅い${C.z}` : `${C.ok}良好${C.z}`;
  say(`  ping   : 平均 ${pingAvg ?? "?"}ms / ロス ${pingLoss ?? "?"}%  ${tag}`);
  if (pingLoss !== null && pingLoss >= 20) {
    say(`  ${C.dim}→ 画面OFF時のWi-Fi省電力が主因のことが多い。端末を充電器に挿し、`);
    say(`     開発者向けオプションの「充電中は画面をONのまま」を ON にしてください。${C.z}`);
  }
  say("");
}

// ── 画面取得の実測 ────────────────────────────────────────────────────────
function measure(label, args, timeoutMs) {
  const times = [], sizes = [];
  for (let i = 0; i < N; i++) {
    const t0 = Date.now();
    const r = adb(["-s", serial, ...args], timeoutMs);
    const ms = Date.now() - t0;
    const bytes = r.stdout?.length || 0;
    if (r.error?.code === "ETIMEDOUT") { say(`  ${label} #${i + 1}: ${C.ng}${timeoutMs / 1000}秒でタイムアウト${C.z}`); return null; }
    if (!bytes) { say(`  ${label} #${i + 1}: ${C.ng}取得失敗${C.z} ${(r.stderr?.toString() || "").trim()}`); return null; }
    times.push(ms); sizes.push(bytes);
    say(`  ${label} #${i + 1}: ${(bytes / 1024).toFixed(0)}KB  ${ms}ms  ${((bytes * 8) / ms / 1000).toFixed(1)}Mbps`);
  }
  const avgMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const avgKb = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length / 1024);
  return { avgMs, avgKb };
}

say(`${C.b}画面取得（PNG）${C.z}  ← 撮影・監視が実際に使う経路`);
const png = measure("PNG", ["exec-out", "screencap", "-p"], 60000);

let raw = null;
if (WITH_RAW) {
  say("");
  say(`${C.b}画面取得（raw）${C.z}  ${C.dim}※遅い回線では固まります${C.z}`);
  raw = measure("raw", ["exec-out", "screencap"], 90000);
}

// ── 判定 ──────────────────────────────────────────────────────────────────
say("");
say(`${C.b}判定${C.z}`);
if (!png) {
  say(`  ${C.ng}画面が取れません。この回線では撮影も監視もできません。${C.z}`);
  say(`  ${C.dim}端末のWi-Fiを入れ直し、ワイヤレスデバッグ画面の値で繋ぎ直してください。${C.z}`);
  process.exit(2);
}
say(`  PNG 平均 ${png.avgKb}KB / ${png.avgMs}ms`);
if (raw) say(`  raw 平均 ${raw.avgKb}KB / ${raw.avgMs}ms`);

let verdict, code = 0;
if (png.avgMs < 1000) {
  verdict = `${C.ok}監視OK${C.z} — 撮影・監視とも問題なく回ります。`;
} else if (png.avgMs < 3000) {
  verdict = `${C.warn}PNGなら可${C.z} — 監視は回せます（--cap png / 既定の auto で自動選択）。ミラーリングは重く感じます。`;
} else {
  verdict = `${C.ng}この回線では無理${C.z} — 1判定に${(png.avgMs / 1000).toFixed(1)}秒かかります。USB を使うか、回線を直してください。`;
  code = 3;
}
say(`  ${verdict}`);
if (isWifi && raw && raw.avgMs > 3000) {
  say(`  ${C.dim}raw は ${(raw.avgMs / 1000).toFixed(1)}秒/枚。Wi-Fi では raw を使わないこと（watch-warehouse は auto で png を選びます）。${C.z}`);
}
process.exit(code);
