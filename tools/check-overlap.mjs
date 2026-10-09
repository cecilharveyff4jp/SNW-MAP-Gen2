#!/usr/bin/env node
// 配置済みオブジェクトのフットプリントが重なっていないか調べる。
//   node tools\check-overlap.mjs --map 1
// 仮設置を足したあとの確認用。重なると地図上で潰れて見えるので、入れた直後に必ず見る。

import { d1query } from "./snw-d1.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const rows = (r) => r.result?.[0]?.results ?? r.results ?? [];
const mapId = Number(arg("--map", "1"));

const objs = rows(await d1query(
  `SELECT id, type, label, anchor_x, anchor_y, w, h FROM objects WHERE map_id = ${mapId} AND placed = 1`
));

const cell = new Map();
const hits = [];
for (const o of objs)
  for (let dx = 0; dx < (o.w || 1); dx++)
    for (let dy = 0; dy < (o.h || 1); dy++) {
      const k = `${o.anchor_x + dx},${o.anchor_y + dy}`;
      if (cell.has(k)) hits.push({ a: cell.get(k), b: o, k });
      else cell.set(k, o);
    }

console.log(`map${mapId} 配置済み ${objs.length}件 / 占有 ${cell.size}マス`);
if (!hits.length) console.log("✅ 重なりなし");
else {
  const seen = new Set();
  console.log(`✗ 重なり ${hits.length}マス:`);
  for (const h of hits) {
    const key = `${h.a.id}-${h.b.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`   ${h.a.type} "${h.a.label}"(id=${h.a.id}) × ${h.b.type} "${h.b.label}"(id=${h.b.id})  @${h.k}`);
  }
  process.exitCode = 1;
}
