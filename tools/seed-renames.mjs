#!/usr/bin/env node
// 【改名12件の下ごしらえ】既存オブジェクトに gameId を先にシードする。
//   こうしておくと apply-ranking.mjs が「gameId優先マッチ」で自動的に改名更新扱いにする
//   （名前が違っても同一人物として総力・名前を反映。新規重複を作らない）。
//   2026-07-25 保守用PCで実行（要 CF_API_TOKEN, CF_ACCOUNT_ID）。
//
//   使い方:
//     node tools\seed-renames.mjs           # ドライラン（実行内容を表示のみ）
//     node tools\seed-renames.mjs --apply    # 実際に gameId をシード
//
//   根拠: apply-report.json の DB内オブジェクト × 総力ランキング の突き合わせ＋盟主確認。

import { d1query } from "./snw-d1.mjs";

const apply = process.argv.includes("--apply");

// [DBのobjects.id, シードする gameId, 参考:DB旧名 → 現ランキング名]
const RENAMES = [
  [15, "463859803", "Mic@寝てます → XENO@試運転中"],
  [39, "464784008", "Luna → Lūna"],
  [42, "449443898", "伏神様りつき → りつき"],
  [44, "460772644", "ｶﾛｰｷｰｽﾄｰﾝ → Karoukeystone"],
  [48, "795867092", "ﾀﾆｦの弍 → タニヲの弐"],
  [53, "456459441", "ﾊｯﾋﾟｰｾｯﾄﾑ👃 → トムっちゅりん"],
  [58, "617121016", "ﾏｯﾁでｰす → マッチでぇーす。"],
  [61, "749090936", "Lumina → Lumina63"],
  [62, "441218927", "ﾀﾆｦ/snow → タニヲ / snow"],
  [76, "793193740", "ちょこｻﾌﾞﾛｰ@資源庫 → ちょこサブロー@資源庫兼務"],
  [77, "454443634", "ぱぷりかだいこん → ぱんぷきん"],
  [84, "749879544", "Rad Peace → Red Peace"],
  [82, "795291306", "りつきのｴｻ → りつごろー"],
];

console.log(`改名シード ${RENAMES.length}件 ${apply ? "（本適用）" : "（ドライラン）"}`);
for (const [id, gid, note] of RENAMES) console.log(`  id=${id}  game_id=${gid}   ${note}`);

if (!apply) {
  console.log(`\n※ ドライラン。実行するには --apply を付けてください。`);
  console.log(`   その後: node tools\\apply-ranking.mjs --ranking tools\\ranking-ids.json           # 差分確認`);
  console.log(`          node tools\\apply-ranking.mjs --ranking tools\\ranking-ids.json --apply --create-new  # 反映`);
  process.exit(0);
}

// 既存の game_id が別値で入っていないか安全確認（想定は全てNULL）
const ids = RENAMES.map((r) => r[0]).join(",");
const cur = await d1query(`SELECT id, label, game_id FROM objects WHERE id IN (${ids})`);
const rows = (cur.result?.[0]?.results ?? cur.results ?? []);
const conflict = rows.filter((r) => r.game_id != null && !RENAMES.some((x) => x[0] === r.id && x[1] === String(r.game_id)));
if (conflict.length) {
  console.error(`\n⚠ 既に別の game_id が入っている行があります。中止します（手動確認してください）:`);
  for (const c of conflict) console.error(`   id=${c.id} "${c.label}" game_id=${c.game_id}`);
  process.exit(1);
}

const sql = RENAMES.map(([id, gid]) => `UPDATE objects SET game_id = '${gid}' WHERE id = ${id};`).join("\n");
await d1query(sql);
console.log(`\n✅ ${RENAMES.length}件に game_id をシードしました。`);
console.log(`次: node tools\\apply-ranking.mjs --ranking tools\\ranking-ids.json            # 差分確認（matched が増えるはず）`);
console.log(`    node tools\\apply-ranking.mjs --ranking tools\\ranking-ids.json --apply --create-new  # 総力更新＋改名反映＋新規(placed=0)`);
