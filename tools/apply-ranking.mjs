#!/usr/bin/env node
// フル半自動：ランキング/マップ(郊外)/プロフィール抽出 → D1の現行objectsと照合 →
//   ・既存メンバー: power反映(+履歴) / 改名追従(member_name) / game_id補完 / FC反映
//                   座標(anchor_x,anchor_y)の同期は既定オフ（--sync-coords 明示時のみ）
//   ・新規メンバー: 座標があれば実座標にCITY配置(placed=1)、無ければ未配置プール(placed=0)
// 保守用PC/チャットどちらでも動く（要 CF_API_TOKEN、CF_ACCOUNT_ID自動取得）。
//
// ★マップの扱い: 都市情報・総力・ゲームID・戦力推移のマスタは --map（既定1=メインマップ）。
//   配置シミュ等のコピーマップは「同じオブジェクトの別配置」なので、メンバー情報(label/power/
//   game_id/fc_level)だけゲームID一致で追従させる（既定ON、--no-sync-copies で停止）。
//   コピーの座標は配置換えの成果物なので絶対に触らない。履歴と監査ログもメインマップ分だけ。
//
// 照合優先: game_id > 名前完全一致 > 緩い一致。データ源で項目は任意:
//   ランキング一覧… name, power(正確)
//   郊外カード…    name, x, y, power(正確)
//   星バッジ…      fcLevel
//   領主ファイル…  gameId, name
//
// 入力(JSON配列)の各要素で使えるキー: name, power, gameId, x, y, fcLevel（すべて任意）
//
// 使い方:
//   node apply-ranking.mjs --ranking data.json                       # ドライラン（既定）
//   node apply-ranking.mjs --ranking data.json --apply               # power/改名/ID/FC を反映
//   node apply-ranking.mjs --ranking data.json --apply --create-new  # 未一致を新規都市登録（座標あれば配置）
//   node apply-ranking.mjs --ranking data.json --apply --sync-coords # 既存都市の座標も実座標へ同期
//   オプション: --include-fuzzy / --source scrcpy(既定) / --map 1(既定) / --no-sync-copies

import fs from "node:fs";
import { matchRanking, extractRows, cleanName, stripTag, toHalf } from "./lib-norm.mjs";
import { d1query } from "./snw-d1.mjs";

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }
const has = (name) => process.argv.includes(name);

const rankingPath = arg("--ranking");
const apply = has("--apply");
const includeFuzzy = has("--include-fuzzy");
const createNew = has("--create-new");
const syncCoords = has("--sync-coords");
const syncCopies = !has("--no-sync-copies");  // 既定ON: コピーマップのメンバー情報をメインに追従（座標は除く）
const snapshot = !has("--no-snapshot");   // 既定ON: 実行ごとにランキング在籍者全員へ現在総力の履歴を1点記録（推移が途切れない）
const audit = !has("--no-audit");         // 既定ON: 構造変更(改名/FC/ID/新規)を audit_log に個別記録＋日次総力は要約1行
const mapId = Number(arg("--map", "1")) || 1;
const source = arg("--source", "scrcpy");
if (!rankingPath) { console.error("usage: node apply-ranking.mjs --ranking <file> [--apply] [--create-new] [--sync-coords] [--include-fuzzy] [--source scrcpy] [--map N] [--no-sync-copies]"); process.exit(1); }

const esc = (s) => String(s).replace(/'/g, "''");
const gidClean = (v) => (v == null ? null : (String(v).replace(/[^0-9]/g, "") || null));
const num = (v) => (v == null || v === "" ? null : (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null));
function normPower(v) { if (v == null) return null; const n = Number(String(v).replace(/[,\s]/g, "")); return Number.isFinite(n) && n >= 0 ? Math.round(n) : null; }
// ★アプリ仕様＝文字列: 溶鉱炉 "1"〜"30" / ファイアクリスタル "FC1"〜"FC10"（そのまま保存）。
const fcClean = (v) => { if (v == null || v === "") return null; const s = String(v).trim(); return (/^([1-9]|[12][0-9]|30)$/.test(s) || /^FC([1-9]|10)$/i.test(s)) ? s : null; };

// PowerShell が書いたJSONは BOM 付きになりがち（Set-Content -Encoding utf8 / Out-File）。素の JSON.parse は落ちるので剥がす。
let ranking = extractRows(JSON.parse(fs.readFileSync(rankingPath, "utf8").replace(/^﻿/, "")));
ranking = ranking.map((r) => ({
  rank: r.rank ?? null,
  name: cleanName(stripTag(r.name ?? "")),
  power: normPower(r.power),
  gameId: gidClean(r.gameId ?? r.game_id),
  x: num(r.x ?? r.anchorX), y: num(r.y ?? r.anchorY),
  fcLevel: fcClean(r.fcLevel ?? r.fc_level),
})).filter((r) => r.name || r.gameId);

// ★ 名前は label に入っている（member_name は未使用）。label を照合名として使う。
// ★ 照合対象は --map のマップだけ。配置シミュ用の複製マップまで拾うと同名2件で全部 exact-ambiguous になる。
const dbData = await d1query(`SELECT id, label, member_name, game_id, power, type, anchor_x, anchor_y, fc_level, placed FROM objects WHERE map_id = ${mapId}`);
const objects = extractRows(dbData).map((o) => ({ ...o, member_name: o.label ?? o.member_name }));
const hasHistory = extractRows(await d1query("SELECT name FROM sqlite_master WHERE type='table' AND name='power_history'")).length > 0;
const hasAudit = extractRows(await d1query("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_log'")).length > 0;
const AUDIT_ACTOR = arg("--actor", "scrcpy-auto");   // 監査ログ上の自動化アクター（人手編集と区別）

const { matched, fuzzy, unmatched, dbOnly } = matchRanking(ranking, objects, { fuzzy: true });

const pool = [...matched, ...(includeFuzzy ? fuzzy.filter((f) => f.id != null && !/ambiguous/.test(f.via || "")) : [])];
const actions = [];
const coordProposals = []; // 既存都市の座標差分（--sync-coordsが無ければ提案のみ）
for (const m of pool) {
  const sets = [];
  const changePower = m.power != null && m.power !== m.oldPower;
  if (changePower) sets.push({ col: "power", sql: `power = ${m.power}` });
  if (m.seedGameId && m.gameId) sets.push({ col: "game_id", sql: `game_id = '${esc(m.gameId)}'` });
  if (m.rename) sets.push({ col: "label", sql: `label = '${esc(toHalf(m.name).slice(0, 100))}'` });
  if (m.fcLevel && String(m.fcLevel) !== String(m.dbFc ?? "")) sets.push({ col: "fc_level", sql: `fc_level = '${esc(m.fcLevel)}'` });
  const coordDiff = m.x != null && m.y != null && (m.x !== m.dbX || m.y !== m.dbY || m.placed === 0);
  if (coordDiff) {
    coordProposals.push({ id: m.id, name: m.dbName, from: `${m.dbX ?? "?"},${m.dbY ?? "?"}${m.placed === 0 ? "(未配置)" : ""}`, to: `${m.x},${m.y}` });
    if (syncCoords) sets.push({ col: "coords", sql: `anchor_x = ${m.x}, anchor_y = ${m.y}, placed = 1` });
  }
  if (sets.length) actions.push({ m, sets, changePower });
}

// ★コピーマップ追従: 配置シミュ等は「同じオブジェクトの別配置」。メンバー情報だけゲームID一致で合わせる。
//   座標(anchor_x/y, placed)は配置換えの成果物そのものなので対象外。新規メンバーもコピーには作らない（配置はGUIの仕事）。
//   比較元は「今回の更新を当てた後のメインマップの値」。actionsの差分だけを見ると、メインが既に
//   反映済みのときにコピーが取り残されるので、毎回メインの現在値と突き合わせて自己修復させる。
const copyActions = [];
if (syncCopies) {
  const pending = new Map();  // メイン行id -> このrunで書き込む新値
  for (const a of actions) {
    const p = {}, col = (c) => a.sets.some((s) => s.col === c);
    if (col("power")) p.power = a.m.power;
    if (col("label")) p.label = toHalf(a.m.name).slice(0, 100);
    if (col("fc_level")) p.fc_level = a.m.fcLevel;
    if (col("game_id")) p.game_id = a.m.gameId;
    pending.set(a.m.id, p);
  }
  const desired = new Map();  // ゲームID -> 反映後のメンバー情報
  for (const o of objects) {
    const p = pending.get(o.id) ?? {};
    const gid = gidClean(p.game_id ?? o.game_id);
    if (!gid) continue;
    desired.set(gid, {
      label: p.label ?? (o.label ?? ""),
      power: p.power ?? (o.power ?? null),
      fc_level: p.fc_level ?? (o.fc_level ?? null),
    });
  }
  const copyRows = extractRows(await d1query(
    `SELECT id, map_id, label, game_id, power, fc_level FROM objects WHERE map_id <> ${mapId} AND game_id IS NOT NULL AND game_id <> ''`
  ));
  for (const r of copyRows) {
    const want = desired.get(gidClean(r.game_id));
    if (!want) continue;   // メインに居ない＝そのコピー固有の行。触らない。
    const sets = [];
    if (String(r.label ?? "") !== String(want.label)) sets.push({ col: "label", sql: `label = '${esc(want.label)}'`, from: r.label ?? null, to: want.label });
    if (want.power != null && Number(r.power ?? NaN) !== Number(want.power)) sets.push({ col: "power", sql: `power = ${Number(want.power)}`, from: r.power ?? null, to: want.power });
    if (String(r.fc_level ?? "") !== String(want.fc_level ?? "")) sets.push({ col: "fc_level", sql: `fc_level = ${want.fc_level == null ? "NULL" : `'${esc(want.fc_level)}'`}`, from: r.fc_level ?? null, to: want.fc_level ?? null });
    if (sets.length) copyActions.push({ row: r, sets });
  }
}
const copyRowCount = copyActions.length;

console.log(`ranking=${ranking.length}  matched=${matched.length}  fuzzy=${fuzzy.length}  unmatched=${unmatched.length}  DB残り=${dbOnly.length}`);
console.log(`履歴: ${hasHistory ? `あり(source='${source}')` : "なし"}   スナップショット: ${snapshot ? "ON(在籍者全員に毎回1点)" : "OFF(--no-snapshot)"}   座標同期: ${syncCoords ? "ON" : "OFF(提案のみ)"}`);
console.log(`\n[1] 更新: ${actions.length}件${apply ? "" : "  ※ドライラン"}`);
for (const a of actions) console.log(`   id=${a.m.id} ${a.m.dbName}  [${a.sets.map((s) => s.col).join("+")}]${a.m.rename ? " 改名→" + a.m.name : ""}`);

if (syncCopies) {
  console.log(`\n[1b] コピーマップ追従: ${copyRowCount}行${apply ? "" : "  ※ドライラン"}（メンバー情報のみ。座標は変更しません）`);
  for (const c of copyActions.filter((c) => c.sets.some((s) => s.col !== "power")))
    console.log(`   map${c.row.map_id}/id=${c.row.id} ${c.row.label}  [${c.sets.map((s) => s.col).join("+")}]` +
      c.sets.filter((s) => s.col === "label").map((s) => ` 改名→${s.to}`).join(""));
} else {
  console.log(`\n[1b] コピーマップ追従: OFF(--no-sync-copies)`);
}

if (coordProposals.length) {
  console.log(`\n[座標差分] ${coordProposals.length}件${syncCoords ? "（--sync-coordsで反映する）" : "（提案のみ。反映は --sync-coords）"}`);
  for (const c of coordProposals) console.log(`   id=${c.id} ${c.name}: ${c.from} → ${c.to}`);
}

console.log(`\n[2] 未一致=新規候補: ${unmatched.length}件`);
for (const u of unmatched) console.log(`   ✗ "${u.name}"${u.gameId ? " ID=" + u.gameId : ""}${u.x != null ? ` @${u.x},${u.y}` : " (座標なし)"} 総力=${u.power ?? "?"}${u.fcLevel ? " " + u.fcLevel : ""}`);
console.log(createNew ? `   → --create-new: 座標ありは実座標配置(placed=1)、無しは未配置プール` : `   → 新規登録するには --create-new`);

if (fuzzy.length) { console.log(`\n[!] 要確認(緩い/曖昧): ${fuzzy.length}件`); for (const f of fuzzy) console.log(`   ? "${f.name}" → id=${f.id} "${f.dbName}" [${f.via}]`); }

if (apply) {
  if (actions.length) {
    // D1 REST は BEGIN/COMMIT 不可。1回の /query 呼び出しが暗黙に原子的（失敗時は自動ロールバック）。
    const s = [];
    for (const a of actions) {
      s.push(`UPDATE objects SET ${a.sets.map((x) => x.sql).join(", ")} WHERE id = ${a.m.id};`);
      // スナップショットON時は下で在籍者全員へまとめて履歴を打つので、ここでの変化時追記は抑制（二重記録防止）。
      if (!snapshot && a.changePower && hasHistory) s.push(`INSERT INTO power_history (object_id, power, source) VALUES (${a.m.id}, ${a.m.power}, '${esc(source)}');`);
    }
    await d1query(s.join("\n"));
    console.log(`\n✅ 更新反映: ${actions.length}件`);
  }
  // コピーマップはメンバー情報だけ追従。履歴(power_history)はメインの行にしか打たないので推移は二重にならない。
  if (copyActions.length) {
    const s = copyActions.map((c) => `UPDATE objects SET ${c.sets.map((x) => x.sql).join(", ")} WHERE id = ${c.row.id};`);
    for (let i = 0; i < s.length; i += 50) await d1query(s.slice(i, i + 50).join("\n"));
    console.log(`✅ コピーマップ追従: ${copyRowCount}行（座標は非対象）`);
  }
  // ★毎回スナップショット: ランキング在籍者(matched)全員に現在総力の履歴を1点記録。総力が動かない人(スマートEX等)も点が付く。
  //   新規メンバーは下の登録時に履歴が入る(＝その人の初回スナップショット)ので、ここは既存matchedのみ。
  if (snapshot && hasHistory) {
    const hs = pool.filter((m) => m.id != null && m.power != null)
      .map((m) => `INSERT INTO power_history (object_id, power, source) VALUES (${m.id}, ${m.power}, '${esc(source)}');`);
    for (let i = 0; i < hs.length; i += 50) await d1query(hs.slice(i, i + 50).join("\n"));  // 文数が多いので分割送信
    console.log(`✅ 履歴スナップショット: ${hs.length}件（在籍者全員に1点）`);
  }
  if (createNew && unmatched.length) {
    const s = [];
    for (const u of unmatched) {
      const nm = esc(toHalf(u.name).slice(0, 100));
      const g = u.gameId ? `'${esc(u.gameId)}'` : "NULL";
      const p = u.power ?? "NULL";
      const fc = u.fcLevel ? `'${esc(u.fcLevel)}'` : "NULL";
      const placed = u.x != null && u.y != null ? 1 : 0;
      const ax = u.x != null && u.y != null ? u.x : 0;
      const ay = u.x != null && u.y != null ? u.y : 0;
      s.push(`INSERT INTO objects (map_id, type, anchor_x, anchor_y, w, h, label, game_id, fc_level, power, placed) VALUES (${mapId}, 'CITY', ${ax}, ${ay}, 2, 2, '${nm}', ${g}, ${fc}, ${p}, ${placed});`);
      if (u.power != null && hasHistory) s.push(`INSERT INTO power_history (object_id, power, source) VALUES (last_insert_rowid(), ${u.power}, '${esc(source)}');`);
    }
    await d1query(s.join("\n"));
    console.log(`✅ 新規都市登録: ${unmatched.length}件（座標ありは配置済み、無しは未配置プール）`);
  }
  // ★編集履歴(audit_log): 構造変更(改名/FC/ID/座標)は対象ごとに1行、日次の総力更新は要約1行。actorで人手編集と区別。
  //   ※power_history が「推移」、audit_log が「誰が何を変えたか」。役割が違うので両方に記録する。
  if (audit && hasAudit) {
    const A = [];
    // 1) 既存オブジェクトの構造変更（power以外の変更があった行だけ個別記録。純power更新は要約に集約）
    for (const a of actions) {
      const struct = a.sets.map((s) => s.col).filter((c) => c !== "power");
      if (!struct.length) continue;
      // 項目キーはアプリの監査書式に合わせる（確認済み: 座標="X"/"Y", FC="FCレベル"）。
      const d = {};
      if (struct.includes("label")) d["名前"] = [a.m.dbName ?? null, toHalf(a.m.name).slice(0, 100)];
      if (struct.includes("game_id")) d["ゲームID"] = [a.m.dbGameId ?? null, a.m.gameId ?? null];
      if (struct.includes("fc_level")) d["FCレベル"] = [a.m.dbFc ?? null, a.m.fcLevel ?? null];
      if (struct.includes("coords")) { d["X"] = [a.m.dbX ?? null, a.m.x]; d["Y"] = [a.m.dbY ?? null, a.m.y]; }
      A.push(`INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail) VALUES ('${esc(AUDIT_ACTOR)}', 'update', 'object', '${a.m.id}', '${esc(a.m.dbName ?? "")}', '${esc(JSON.stringify(d))}');`);
    }
    // 2) 新規登録（登録直後の行を game_id で引いて create を記録）
    if (createNew) for (const u of unmatched) {
      const d = { created: { label: toHalf(u.name).slice(0, 100), power: u.power ?? null, game_id: u.gameId ?? null, fc_level: u.fcLevel ?? null, placed: (u.x != null && u.y != null) ? 1 : 0 } };
      const detail = esc(JSON.stringify(d)), nm = esc(toHalf(u.name).slice(0, 100));
      // ※コピーマップにも同じ game_id / label の行が居るので、map_id を必ず絞る（絞らないと複数件記録される）。
      if (u.gameId) A.push(`INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail) SELECT '${esc(AUDIT_ACTOR)}','create','object', CAST(id AS TEXT), label, '${detail}' FROM objects WHERE map_id=${mapId} AND game_id='${esc(u.gameId)}';`);
      else A.push(`INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail) SELECT '${esc(AUDIT_ACTOR)}','create','object', CAST(MAX(id) AS TEXT), '${nm}', '${detail}' FROM objects WHERE map_id=${mapId} AND label='${nm}';`);
    }
    // 3) 実行サマリ（日次の総力更新・スナップショットはここに集約）
    const summary = { source, updated: actions.length, renamed: actions.filter((a) => a.m.rename).length, fc_changed: actions.filter((a) => a.sets.some((s) => s.col === "fc_level")).length, created: createNew ? unmatched.length : 0, snapshots: snapshot ? pool.filter((m) => m.id != null && m.power != null).length : 0, map_id: mapId, copy_rows_synced: copyRowCount };
    A.push(`INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail) VALUES ('${esc(AUDIT_ACTOR)}', 'sync', 'ranking', NULL, '総力ランキング自動同期', '${esc(JSON.stringify(summary))}');`);
    for (let i = 0; i < A.length; i += 50) await d1query(A.slice(i, i + 50).join("\n"));
    console.log(`✅ 監査ログ(audit_log): ${A.length}件（個別${A.length - 1}＋要約1、actor='${AUDIT_ACTOR}'）`);
  }
} else {
  console.log(`\n※ ドライラン。反映は --apply（新規は --create-new、既存座標は --sync-coords）`);
}

fs.writeFileSync("apply-report.json", JSON.stringify({
  updates: actions.map((a) => ({ ...a.m, cols: a.sets.map((s) => s.col) })),
  copySync: { enabled: syncCopies, rows: copyRowCount, targets: copyActions.map((c) => ({ id: c.row.id, mapId: c.row.map_id, name: c.row.label, gameId: c.row.game_id, changes: c.sets.map((s) => ({ col: s.col, from: s.from, to: s.to })) })) },
  coordProposals, needsReview: fuzzy, newMembers: unmatched, notInRanking: dbOnly, hasHistory, source, mapId,
}, null, 2));
console.log(`\nレポート: apply-report.json`);
