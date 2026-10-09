#!/usr/bin/env node
// 指定メンバーの現在総力と power_history の有無を確認する診断ツール。
//   使い方（保守用PC、要 CF_API_TOKEN, CF_ACCOUNT_ID）:
//     node tools\check-history.mjs 750289064        # game_id で（スマートEX）
//     node tools\check-history.mjs スマートEX         # 名前(label)の部分一致で
//
// power_history が 0 行なら「推移が見えない」原因はそれ。

import { d1query } from "./snw-d1.mjs";

const key = process.argv[2];
if (!key) { console.error("usage: node tools\\check-history.mjs <game_id | 名前>"); process.exit(1); }
const esc = (s) => String(s).replace(/'/g, "''");
const isGid = /^[0-9]{6,12}$/.test(key);

const rows = (r) => (r.result?.[0]?.results ?? r.results ?? []);
const where = isGid ? `game_id = '${esc(key)}'` : `label LIKE '%${esc(key)}%'`;
const objs = rows(await d1query(`SELECT id, label, game_id, power, placed FROM objects WHERE ${where}`));
if (!objs.length) { console.log(`該当なし: ${key}`); process.exit(0); }

// power_history の列名は環境依存（created_at が無い等）なので SELECT * ＋ rowid 並べで取得。
for (const o of objs) {
  const h = rows(await d1query(`SELECT rowid AS _rid, * FROM power_history WHERE object_id = ${o.id} ORDER BY rowid DESC LIMIT 8`));
  console.log(`\n■ id=${o.id}  ${o.label}  game_id=${o.game_id ?? "なし"}  現在総力=${o.power?.toLocaleString?.() ?? o.power}  placed=${o.placed}`);
  console.log(`  power_history: ${h.length ? h.length + "行（最新→）" : "★0行（＝推移が出ない原因）"}`);
  for (const r of h) {
    const t = r.created_at ?? r.recorded_at ?? r.ts ?? r.time ?? r.date ?? r.updated_at ?? "(時刻列なし)";
    console.log(`    ${t}  power=${Number(r.power).toLocaleString()}  [${r.source ?? ""}]`);
  }
  if (h.length) console.log(`  （列: ${Object.keys(h[0]).filter((k) => k !== "_rid").join(", ")}）`);
}
