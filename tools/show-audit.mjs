#!/usr/bin/env node
// audit_log（編集履歴）の直近行と、objects.fc_level の実値分布を確認する。
//   目的: アプリが audit_log にどんな action/entity/detail で書いているかを把握し、
//         自動同期の記録を同じ書式に合わせる。fc_level の実際の入り方も点検。
//   使い方: node tools\show-audit.mjs   （必要なら > audit-sample.txt でファイル保存）

import { d1query } from "./snw-d1.mjs";
const rows = (r) => (r.result?.[0]?.results ?? r.results ?? []);

console.log("==== audit_log 直近20行 ====");
const a = rows(await d1query(`SELECT * FROM audit_log ORDER BY id DESC LIMIT 20`));
if (!a.length) console.log("  （0行）");
for (const r of a) console.log("  " + JSON.stringify(r, null, 0));

console.log("\n==== audit_log の action 種別と件数 ====");
for (const r of rows(await d1query(`SELECT action, entity, COUNT(*) AS n FROM audit_log GROUP BY action, entity ORDER BY n DESC`)))
  console.log(`  action=${r.action}  entity=${r.entity}  ${r.n}件`);

console.log("\n==== objects.fc_level の実値（先頭30・型混在チェック）====");
for (const r of rows(await d1query(`SELECT id, label, fc_level, typeof(fc_level) AS t FROM objects WHERE fc_level IS NOT NULL ORDER BY id LIMIT 30`)))
  console.log(`  id=${r.id}  ${r.label}  fc_level=${JSON.stringify(r.fc_level)}  typeof=${r.t}`);

console.log("\n==== power_history 直近5行（列名確認）====");
for (const r of rows(await d1query(`SELECT * FROM power_history ORDER BY id DESC LIMIT 5`)))
  console.log("  " + JSON.stringify(r));
