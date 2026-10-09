#!/usr/bin/env node
// スマートEX（自分）など「ランキングから自動取得できない」アカウントの溶鉱炉/FCレベルを手動更新する。
//   ★FCは可変値なので固定ハードコードしない。レベルアップの都度これを実行して最新値にする。
//   ★アプリ仕様＝文字列: 溶鉱炉は "1"〜"30"、ファイアクリスタルは "FC1"〜"FC10"（そのまま保存）。
//   既定の対象は スマートEX(game_id=750289064)。--gid で他アカウントも可。
//
//   使い方（保守用PC、要 CF_API_TOKEN, CF_ACCOUNT_ID）:
//     node tools\set-self-fc.mjs 17            # ドライラン（現在値と変更内容を表示）
//     node tools\set-self-fc.mjs 17 --apply    # 溶鉱炉Lv17 に更新
//     node tools\set-self-fc.mjs FC1 --apply   # ファイアクリスタルFC1に更新
//     node tools\set-self-fc.mjs 30 --apply --gid 750289064

import { d1query } from "./snw-d1.mjs";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
let level = argv.find((a) => !a.startsWith("--") && a !== opt("--gid"));
const gid = opt("--gid") || "750289064"; // 既定: スマートEX
const apply = flag("--apply");
const actor = opt("--actor") || "scrcpy-auto";

// 文字列のまま（"FC8"はそのまま、"08"等は正規化）。溶鉱炉"1"〜"30" / FC"FC1"〜"FC10"。
if (level != null) { const s = String(level).trim(); level = /^FC/i.test(s) ? s.toUpperCase() : String(Math.trunc(Number(s)) || s); }
const valid = /^([1-9]|[12][0-9]|30)$/.test(level || "") || /^FC([1-9]|10)$/.test(level || "");
if (level == null || !valid) {
  console.error(`usage: node tools\\set-self-fc.mjs <レベル> [--apply] [--gid <game_id>]`);
  console.error(`  レベル: 溶鉱炉 "1"〜"30" / ファイアクリスタル "FC1"〜"FC10"`);
  process.exit(1);
}
const esc = (s) => String(s).replace(/'/g, "''");
const rows = (r) => (r.result?.[0]?.results ?? r.results ?? []);

const cur = rows(await d1query(`SELECT id, label, game_id, fc_level FROM objects WHERE game_id = '${esc(gid)}'`));
if (!cur.length) { console.error(`game_id=${gid} の行が見つかりません。`); process.exit(1); }
const o = cur[0];
const oldVal = o.fc_level == null || o.fc_level === "" ? null : String(o.fc_level);
console.log(`対象: id=${o.id}  ${o.label}  game_id=${o.game_id}`);
console.log(`  fc_level: ${oldVal ?? "(未設定)"} → ${level}`);

if (!apply) { console.log(`\n※ ドライラン。反映するには --apply を付けてください。`); process.exit(0); }
if (oldVal === String(level)) { console.log(`\n変更なし（既に ${level}）。`); process.exit(0); }

const stmts = [`UPDATE objects SET fc_level = '${esc(level)}' WHERE id = ${o.id};`];
// 編集履歴(audit_log)にも1行（アプリ書式に合わせて detail={"FCレベル":[旧,新]}）
const hasAudit = rows(await d1query("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_log'")).length > 0;
if (hasAudit) {
  const detail = JSON.stringify({ "FCレベル": [oldVal, String(level)] });
  stmts.push(`INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail) VALUES ('${esc(actor)}','update','object','${o.id}','${esc(o.label ?? "")}','${esc(detail)}');`);
}
await d1query(stmts.join("\n"));
console.log(`\n✅ ${o.label} の fc_level を ${level} に更新${hasAudit ? "＋監査ログ記録" : ""}しました。`);
console.log(`（レベルが上がったら、また新しい値でこのコマンドを実行してください。固定はしません。）`);
