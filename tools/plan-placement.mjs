#!/usr/bin/env node
// 新規加入メンバーの都市を「熊罠の周り」に仮設置するための空きマス探し。
//
//   node tools\plan-placement.mjs --map 1 --near 熊罠 --count 8 [--size 2]
//   node tools\plan-placement.mjs --map 1 --dump            # 盤面の中身を出すだけ
//
// 考え方:
//   既存オブジェクトの占有矩形（anchor_x, anchor_y, w, h）を全部敷き詰めた盤面を作り、
//   指定した基準物（熊罠）の中心から近い順に、2x2 が丸ごと空いている位置を拾う。
//   ★anchor_x/anchor_y は「フットプリントの最小角」。中心ではないので w,h をそのまま足す。
//   ★仮設置なので隣接は許すが、1マスも重ねない（重なると地図上で潰れて見える）。

import { d1query } from "./snw-d1.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes(n);
const rows = (r) => r.result?.[0]?.results ?? r.results ?? [];

const mapId = Number(arg("--map", "1"));
const near = arg("--near", "熊罠");
const count = Number(arg("--count", "8"));
const size = Number(arg("--size", "2"));
const gap = Number(arg("--gap", "0"));   // 既存物とのすき間（0=隣接可）

const objs = rows(await d1query(
  `SELECT id, type, label, anchor_x, anchor_y, w, h, placed FROM objects WHERE map_id = ${mapId}`
));

// ★fetch のあとで process.exit() を呼ぶと libuv が assert して落ちる（snw-d1.mjs の注記と同じ）。
//   終わりたいときは分岐で抜ける。
const dumpOnly = has("--dump");
if (dumpOnly) {
  for (const o of objs.filter((o) => o.type !== "CITY"))
    console.log(`${o.type}\t${o.label}\t(${o.anchor_x},${o.anchor_y})\t${o.w}x${o.h}\tplaced=${o.placed}`);
  const xs = objs.filter((o) => o.placed).map((o) => o.anchor_x), ys = objs.filter((o) => o.placed).map((o) => o.anchor_y);
  console.log(`\n配置済み ${xs.length}件  x ${Math.min(...xs)}..${Math.max(...xs)}  y ${Math.min(...ys)}..${Math.max(...ys)}`);
}

if (!dumpOnly) {
const anchors = objs.filter((o) => o.placed);
const occupied = new Set();
for (const o of anchors)
  for (let dx = 0; dx < (o.w || 1); dx++)
    for (let dy = 0; dy < (o.h || 1); dy++)
      occupied.add(`${o.anchor_x + dx},${o.anchor_y + dy}`);

const traps = objs.filter((o) => String(o.label ?? "").includes(near) || o.type === "BEAR_TRAP");
if (!traps.length) { console.error(`基準物 "${near}" が見つかりません。`); process.exitCode = 1; }
console.log(`基準にする物 ${traps.length}件:`);
for (const t of traps) console.log(`  ${t.label}  (${t.anchor_x},${t.anchor_y}) ${t.w}x${t.h}`);

// 基準物の中心（複数あれば平均）
const cx = traps.reduce((s, t) => s + t.anchor_x + (t.w || 1) / 2, 0) / traps.length;
const cy = traps.reduce((s, t) => s + t.anchor_y + (t.h || 1) / 2, 0) / traps.length;
console.log(`\n中心 (${cx.toFixed(1)}, ${cy.toFixed(1)}) から近い順に ${size}x${size} の空きを探します。`);

const free = (x, y) => {
  for (let dx = -gap; dx < size + gap; dx++)
    for (let dy = -gap; dy < size + gap; dy++)
      if (occupied.has(`${x + dx},${y + dy}`)) return false;
  return true;
};

const picks = [];
for (let r = 1; r <= 60 && picks.length < count; r++) {
  const cand = [];
  for (let x = Math.round(cx - r); x <= Math.round(cx + r); x++)
    for (let y = Math.round(cy - r); y <= Math.round(cy + r); y++) {
      if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) < r - 0.5) continue; // 内側は既に見た
      if (x < 0 || y < 0) continue;
      if (!free(x, y)) continue;
      cand.push({ x, y, d: Math.hypot(x + size / 2 - cx, y + size / 2 - cy) });
    }
  cand.sort((a, b) => a.d - b.d);
  for (const c of cand) {
    if (picks.length >= count) break;
    if (!free(c.x, c.y)) continue;
    picks.push(c);
    for (let dx = 0; dx < size; dx++) for (let dy = 0; dy < size; dy++) occupied.add(`${c.x + dx},${c.y + dy}`);
  }
}

console.log(`\n空き ${picks.length}件:`);
picks.forEach((p, i) => console.log(`  ${i + 1}  (${p.x}, ${p.y})  距離 ${p.d.toFixed(1)}`));
console.log(`\nJSON: ${JSON.stringify(picks.map((p) => ({ x: p.x, y: p.y })))}`);
}
