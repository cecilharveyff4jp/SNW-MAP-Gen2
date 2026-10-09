#!/usr/bin/env node
// 保守用PC用：スマホへの adb 接続を USB から Wi-Fi（ワイヤレスデバッグ）へ切り替える案内＆実行ツール。
//
// 設計事情（ここを外すと毎回ハマる）:
//   ・Android 11+ の「ワイヤレスデバッグ」は【ペアリング用ポート】と【接続用ポート】が別物で、
//     どちらもアプリ再起動・Wi-Fi再接続のたびに変わる。IPもDHCPで変わる。
//     → 固定値を覚えても意味がないので、毎回 mDNS で「今の IP:ポート」を発見する。
//   ・ペアリング（PIN入力）は端末とPCの組み合わせにつき【初回だけ】。以後は connect だけで繋がる。
//     → 2回目以降は `--auto` で完全ノー入力。IPが変わっても mDNS が追随する。
//   ・adb は `-s` 未指定なら環境変数 ANDROID_SERIAL を見る。既存の capture-*.mjs を1行も変えずに
//     Wi-Fi 端末を掴ませるため、接続後のシリアルを tools/.adb-target に保存して使い回す。
//
// 使い方:
//   node tools\connect-wifi.mjs                       … 手順を表示して対話で接続（ターミナルから手動実行用）
//   node tools\connect-wifi.mjs --auto                … 無入力で再接続（mDNS→保存済みの順に試す。2回目以降はこれ）
//   node tools\connect-wifi.mjs --pair 192.168.0.5:41234 --code 123456   … ペアリングだけ（初回）
//   node tools\connect-wifi.mjs --connect 192.168.0.5:37251             … 接続だけ
//   node tools\connect-wifi.mjs --status / --disconnect
//
//   接続後、他ツールを動かす前に:  . tools\adb-env.ps1   （$env:ADB と $env:ANDROID_SERIAL を入れる）

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARGET_FILE = path.join(HERE, ".adb-target");

function arg(n, d) { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; }
const has = (n) => process.argv.includes(n);

// --- adb の場所（このPCは scrcpy 同梱の adb を使う。PATH には無い） ---
function resolveAdb() {
  const cands = [arg("--adb"), process.env.ADB, "D:\\Prog\\scrcpy-win64-v3.3.1\\adb.exe", "adb"].filter(Boolean);
  for (const c of cands) {
    if (c !== "adb" && !fs.existsSync(c)) continue;
    const r = spawnSync(c, ["version"], { encoding: "utf8" });
    if (!r.error && /Android Debug Bridge/.test(r.stdout || "")) return c;
  }
  return null;
}
const ADB = resolveAdb();
if (!ADB) {
  console.error("adb が見つかりません。--adb <adb.exeのフルパス> か $env:ADB で指定してください。");
  console.error('  例: $env:ADB="D:\\Prog\\scrcpy-win64-v3.3.1\\adb.exe"');
  process.exit(1);
}

function adb(args, timeout = 20000) {
  const r = spawnSync(ADB, args, { encoding: "utf8", timeout });
  return { code: r.status, out: (r.stdout || "").trim(), err: (r.stderr || "").trim(), timedOut: r.error?.code === "ETIMEDOUT" };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const C = { ok: "\x1b[32m", ng: "\x1b[31m", dim: "\x1b[90m", b: "\x1b[1m", z: "\x1b[0m" };
const say = (s = "") => console.log(s);
const step = (n, t) => say(`\n${C.b}【手順${n}】${t}${C.z}`);
const ok = (s) => say(`  ${C.ok}✔${C.z} ${s}`);
const ng = (s) => say(`  ${C.ng}✘${C.z} ${s}`);
const note = (s) => say(`  ${C.dim}${s}${C.z}`);

const IPPORT = /^\d{1,3}(?:\.\d{1,3}){3}:\d{2,5}$/;

// --- mDNS で「今の」ワイヤレスデバッグ端末を探す（IPが毎回変わる問題の本命対策） ---
// 出力例:  adb-1A2B3C-xYzW	_adb-tls-connect._tcp	192.168.0.5:37251
function mdns(kind) {
  const r = adb(["mdns", "services"], 8000);
  const svc = kind === "pair" ? "_adb-tls-pairing._tcp" : "_adb-tls-connect._tcp";
  const found = [];
  for (const line of r.out.split(/\r?\n/)) {
    if (!line.includes(svc)) continue;
    const m = line.match(/(\d{1,3}(?:\.\d{1,3}){3}:\d{2,5})\s*$/);
    if (m) found.push({ name: line.trim().split(/\s+/)[0], addr: m[1] });
  }
  return found;
}
// mDNS は登録に数秒かかる。少し粘って探す。
async function mdnsWait(kind, tries = 6, waitMs = 1200) {
  for (let i = 0; i < tries; i++) {
    const f = mdns(kind);
    if (f.length) return f;
    if (i === 0) note(`mDNS で探索中...（端末のワイヤレスデバッグ画面を開いたままにしてください）`);
    await sleep(waitMs);
  }
  return [];
}

function devices() {
  const r = adb(["devices"]);
  return r.out.split(/\r?\n/).slice(1).map((l) => l.trim()).filter(Boolean)
    .map((l) => { const [serial, state] = l.split(/\s+/); return { serial, state }; });
}
const wifiDevices = () => devices().filter((d) => IPPORT.test(d.serial) && d.state === "device");

function saveTarget(serial) {
  fs.writeFileSync(TARGET_FILE, JSON.stringify({ serial, adb: ADB, updatedAt: new Date().toISOString() }, null, 2));
}
function loadTarget() {
  try { return JSON.parse(fs.readFileSync(TARGET_FILE, "utf8")); } catch { return null; }
}

function verify(serial) {
  const sz = adb(["-s", serial, "shell", "wm", "size"]);
  const m = sz.out.match(/(\d+)\s*x\s*(\d+)/);
  if (!m) return null;
  const model = adb(["-s", serial, "shell", "getprop", "ro.product.model"]).out;
  return { w: +m[1], h: +m[2], model };
}

function doConnect(addr) {
  const r = adb(["connect", addr], 15000);
  const good = /connected to/i.test(r.out);   // "connected to" / "already connected to" 両方拾う
  return { good, msg: (r.out || r.err || "(応答なし)").split(/\r?\n/).pop() };
}

function doPair(addr, code) {
  const r = adb(["pair", addr, code], 25000);
  const good = /Successfully paired/i.test(r.out);
  return { good, msg: (r.out || r.err || "(応答なし)").split(/\r?\n/).filter(Boolean).pop() };
}

// 接続成立 → 検証 → 保存 → 次にやることを表示
function settle(serial) {
  const v = verify(serial);
  if (!v) { ng(`${serial} に接続はしたが応答がありません（端末の「このPCを許可」を確認）`); return false; }
  ok(`接続完了: ${C.b}${serial}${C.z}  ${v.model} ${v.w}x${v.h}`);
  saveTarget(serial);
  note(`保存先: tools\\.adb-target`);
  say(`\n${C.b}次にやること${C.z}`);
  say(`  PowerShell で:  ${C.b}. tools\\adb-env.ps1${C.z}   ← $env:ADB と $env:ANDROID_SERIAL が入る`);
  say(`  以降 capture-*.mjs は USB のときと同じコマンドで動きます。`);
  say(`  USB を抜いてよいのはこの後です。`);
  return true;
}

function showStatus() {
  const ds = devices();
  say(`${C.b}adb${C.z}: ${ADB}`);
  if (!ds.length) { ng("接続済みデバイスなし"); return false; }
  for (const d of ds) {
    const kind = IPPORT.test(d.serial) ? "Wi-Fi" : "USB";
    (d.state === "device" ? ok : ng)(`${d.serial}  [${kind}] ${d.state}`);
  }
  const t = loadTarget();
  if (t) note(`保存済みターゲット: ${t.serial} (${t.updatedAt})`);
  return true;
}

// ================= モード分岐 =================

if (has("--status")) { showStatus(); process.exit(0); }

if (has("--disconnect")) {
  const r = adb(["disconnect"]);
  say(r.out || "disconnected");
  process.exit(0);
}

// 個別実行（チャットから値だけ渡して叩く用。対話不要）
if (arg("--pair") || arg("--connect")) {
  const pairAddr = arg("--pair"), code = arg("--code"), connAddr = arg("--connect");
  if (pairAddr) {
    if (!IPPORT.test(pairAddr)) { console.error(`--pair は IP:ポート 形式で指定してください（例 192.168.0.5:41234）: ${pairAddr}`); process.exit(1); }
    if (!code) { console.error("--pair には --code <6桁のペア設定コード> が必要です。"); process.exit(1); }
    const p = doPair(pairAddr, code);
    (p.good ? ok : ng)(p.msg);
    if (!p.good) {
      note("よくある原因: ペアリング用ポート（ダイアログに出る方）ではなく接続用ポートを入れている / コードの有効期限切れ（ダイアログを開き直す）");
      process.exit(1);
    }
  }
  let addr = connAddr;
  if (!addr) {
    const f = await mdnsWait("connect");
    if (!f.length) { ng("接続用アドレスを mDNS で発見できませんでした。--connect <IP:ポート> を指定してください。"); process.exit(1); }
    addr = f[0].addr; ok(`mDNS で発見: ${addr}`);
  }
  if (!IPPORT.test(addr)) { console.error(`--connect は IP:ポート 形式で指定してください: ${addr}`); process.exit(1); }
  const c = doConnect(addr);
  (c.good ? ok : ng)(c.msg);
  process.exit(c.good && settle(addr) ? 0 : 1);
}

// --auto: 無入力で再接続（2回目以降の通常ルート）
if (has("--auto")) {
  say(`${C.b}Wi-Fi 接続（自動）${C.z}`);
  const live = wifiDevices();
  if (live.length) { ok(`すでに Wi-Fi 接続中: ${live[0].serial}`); process.exit(settle(live[0].serial) ? 0 : 1); }

  const f = await mdnsWait("connect", 5);
  const cands = f.map((x) => x.addr);
  const saved = loadTarget()?.serial;
  if (saved && !cands.includes(saved)) cands.push(saved); // mDNSが出ない環境向けの保険（IPが変わっていれば失敗する）

  for (const addr of cands) {
    const c = doConnect(addr);
    if (c.good) { ok(`${addr} に接続`); if (settle(addr)) process.exit(0); }
    else ng(`${addr}: ${c.msg}`);
  }
  ng("自動接続できませんでした。");
  note("端末で ワイヤレスデバッグ が ON か、PCと同じ Wi-Fi かを確認してください。");
  note("初回（未ペアリング）なら:  node tools\\connect-wifi.mjs   を対話で実行してください。");
  process.exit(1);
}

// ================= 対話モード（初回セットアップ） =================

say(`${C.b}=== スマホ接続を USB → Wi-Fi に切り替えます ===${C.z}`);
note(`adb: ${ADB}`);
note(`IPとポートは端末を再接続するたびに変わります。このツールは毎回 mDNS で今の値を探すので、覚える必要はありません。`);

if (!process.stdin.isTTY) {
  say(`\n${C.ng}※ 対話入力ができない環境で起動されました。${C.z}`);
  say(`  端末側の準備（下記 手順1〜3）を済ませたうえで、値を引数で渡してください:`);
  say(`    node tools\\connect-wifi.mjs --pair <ペアリング用IP:ポート> --code <6桁>`);
  say(`    node tools\\connect-wifi.mjs --auto            （ペアリング済みなら これだけ）`);
}

const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
const ask = async (q) => (rl ? (await rl.question(`  ${q}`)).trim() : "");
const pause = async (q) => { if (rl) await rl.question(`  ${C.dim}${q}${C.z}`); };

try {
  step(1, "対象のスマホの Wi-Fi をオンにしてください");
  note("このPCと同じネットワーク（同じルーター）に繋いでください。ゲストWi-Fiやモバイル回線だと繋がりません。");
  await pause("できたら Enter → ");

  step(2, "開発者向けオプションで「ワイヤレスデバッグ」をオンにしてください");
  note("設定 → システム → 開発者向けオプション → ワイヤレスデバッグ を ON");
  note("（開発者向けオプションが無い場合: 設定 → デバイス情報 → ビルド番号を7回タップ）");
  await pause("できたら Enter → ");

  // すでにペアリング済みなら、ここでもう繋がる。IPが変わっていても mDNS が拾う。
  say("");
  note("ペアリング済みかどうか自動判定しています...");
  const already = await mdnsWait("connect", 4);
  let connected = false;
  for (const f of already) {
    const c = doConnect(f.addr);
    if (c.good && settle(f.addr)) { connected = true; break; }
  }

  if (!connected) {
    step(3, "「ペア設定コードによるデバイスのペア設定」をタップしてください");
    note("ワイヤレスデバッグ画面の中にあります。IPアドレスとポート／6桁のコードが出るダイアログが開きます。");
    note("★ このダイアログは開いたままにしてください（閉じるとコードが無効になります）");
    await pause("ダイアログが出たら Enter → ");

    step(4, "IPアドレスを入力してください");
    const sug = await mdnsWait("pair", 4);
    if (sug.length) note(`検出候補: ${sug.map((s) => s.addr).join(" / ")}  ← そのまま Enter でこれを使います`);
    note("ダイアログの「IP アドレスとポート」の行をそのまま（例 192.168.0.5:41234）");
    let pairAddr = "";
    for (;;) {
      pairAddr = (await ask("IP:ポート > ")) || sug[0]?.addr || "";
      if (IPPORT.test(pairAddr)) break;
      ng("IP:ポート の形式で入力してください（例 192.168.0.5:41234）");
      if (!rl) process.exit(1);
    }

    step(5, "PIN（6桁のペア設定コード）を入力してください");
    let code = "";
    for (;;) {
      code = (await ask("PIN > ")).replace(/\D/g, "");
      if (code.length === 6) break;
      ng("6桁の数字で入力してください");
      if (!rl) process.exit(1);
    }

    say("");
    const p = doPair(pairAddr, code);
    (p.good ? ok : ng)(p.msg);
    if (!p.good) {
      note("ダイアログを開き直して、新しいコードでもう一度実行してください。");
      note("※ ここで使うのは【ペア設定ダイアログ側】のポートです。画面上部の接続用ポートではありません。");
      process.exit(1);
    }
    note("ペアリングは初回だけです。次回からは --auto だけで繋がります。");

    step(6, "接続します");
    const f = await mdnsWait("connect", 6);
    let addrs = f.map((x) => x.addr);
    if (!addrs.length) {
      note("mDNS で見つかりませんでした。ワイヤレスデバッグ画面の上部に出ている「IP アドレスとポート」を入力してください。");
      const manual = await ask("IP:ポート > ");
      if (IPPORT.test(manual)) addrs = [manual];
    }
    for (const addr of addrs) {
      const c = doConnect(addr);
      (c.good ? ok : ng)(`${addr}: ${c.msg}`);
      if (c.good && settle(addr)) { connected = true; break; }
    }
  }

  say("");
  if (!connected) { ng("接続できませんでした。ワイヤレスデバッグの ON/OFF を一度切り替えて、もう一度試してください。"); process.exit(1); }
  showStatus();
} finally {
  rl?.close();
}
