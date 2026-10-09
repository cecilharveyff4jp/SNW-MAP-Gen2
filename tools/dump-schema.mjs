#!/usr/bin/env node
// デプロイ中のD1スキーマ全体をダンプ（編集履歴機能の影響調査用）。
//   sqlite_master の全DDL（テーブル定義・トリガー・インデックス・ビュー）＋ objects の列＋主要テーブルの件数。
//   これで「新しい編集履歴テーブル」「objectsの新カラム」「トリガーの有無」が一目で分かる。
//
//   使い方（保守用PC、要 CF_API_TOKEN, CF_ACCOUNT_ID）:
//     node tools\dump-schema.mjs                 # 画面に表示
//     node tools\dump-schema.mjs > schema-now.txt  # ファイルに保存して共有

import { d1query } from "./snw-d1.mjs";
const rows = (r) => (r.result?.[0]?.results ?? r.results ?? []);

console.log("==== schema_version (meta) ====");
try { for (const m of rows(await d1query(`SELECT key, value FROM meta`))) console.log(`  ${m.key} = ${m.value}`); } catch (e) { console.log("  (meta読取失敗: " + e.message + ")"); }

console.log("\n==== sqlite_master 全DDL（type/name別）====");
const master = rows(await d1query(`SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`));
for (const o of master) {
  console.log(`\n--- [${o.type}] ${o.name} ---`);
  console.log(o.sql || "(sql無し)");
}

console.log("\n==== objects の列（PRAGMA table_info）====");
for (const c of rows(await d1query(`PRAGMA table_info(objects)`))) {
  console.log(`  ${c.cid}  ${c.name}  ${c.type}  notnull=${c.notnull}  default=${c.dflt_value ?? "なし"}  pk=${c.pk}`);
}

console.log("\n==== トリガー一覧（objects/履歴系に注目）====");
const trigs = master.filter((o) => o.type === "trigger");
console.log(trigs.length ? trigs.map((t) => "  - " + t.name).join("\n") : "  （トリガーなし）");

console.log("\n==== 履歴/監査っぽいテーブルの件数 ====");
const histLike = master.filter((o) => o.type === "table" && /(hist|audit|log|edit|revision|change|version)/i.test(o.name));
if (!histLike.length) console.log("  （名前に history/audit/log/edit/revision/change を含むテーブルは無し）");
for (const t of histLike) {
  try { const c = rows(await d1query(`SELECT COUNT(*) AS n FROM ${t.name}`))[0]?.n; console.log(`  ${t.name}: ${c}行`); } catch (e) { console.log(`  ${t.name}: 件数取得失敗 ${e.message}`); }
}

console.log("\n==== 全テーブル一覧 ====");
console.log(master.filter((o) => o.type === "table").map((o) => "  - " + o.name).join("\n"));
