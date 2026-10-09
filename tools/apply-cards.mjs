#!/usr/bin/env node
// 【都市カード → 配置反映】capture-cards.mjs で撮ったカードをチャットで読み取った JSON を、
//   DB の該当メンバーに突合して anchor_x/anchor_y をセットし placed=1（未配置プール→地図に配置）する。
//
//   照合優先: game_id > 名前完全一致 > 名前の緩い一致(+総力一致で確定)。
//   カードの総力は正確なので、緩い一致は「総力も一致」なら自動確定に格上げする（--power-tol で許容幅）。
//
// 既定の安全設計（apply-ranking.mjs と同じ思想）:
//   ・既定はドライラン。書き込むのは --apply の時だけ。
//   ・動かすのは placed=0（未配置）のみ。既に配置済みの座標変更は --move-existing を明示した時だけ。
//   ・他オブジェクトのフットプリントと重なる配置はスキップ（--force で強行）。
//   ・総力はカード値で更新し power_history にも記録。構造変更は audit_log に個別＋要約1行。
//
// 使い方:
//   node apply-cards.mjs --cards tools\cards.json                        # ドライラン（既定）
//   node apply-cards.mjs --cards tools\cards.json --apply                # 未配置を配置(placed=1)＋総力/FC反映
//   node apply-cards.mjs --cards tools\cards.json --apply --move-existing # 配置済みの座標ズレも修正
//   node apply-cards.mjs --cards tools\cards.json --apply --create-new   # DBに居ない人をその座標で新規CITY登録
//   オプション: --include-fuzzy / --force / --power-tol 0 / --source scrcpy / --map 1 / --actor scrcpy-auto
//
// 入力(JSON配列)の各要素: { name, x, y, power?, gameId?, fcLevel? }  ※x,y は必須（座標が無い行は無視）

import fs from "node:fs";
import { matchRanking, extractRows, cleanName, stripTag, toHalf } from "./lib-norm.mjs";
import { d1query } from "./snw-d1.mjs";

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }
const has = (name) => process.argv.includes(name);

const cardsPath = arg("--cards");
const apply = has("--apply");
const includeFuzzy = has("--include-fuzzy");   // 総力が一致しない緩い一致も反映対象にする
const moveExisting = has("--move-existing");   // 既に placed=1 の都市の座標も直す
const createNew = has("--create-new");
const force = has("--force");                  // フットプリント衝突を無視して配置
const audit = !has("--no-audit");
const powerTol = Number(arg("--power-tol", "0"));  // 総力一致とみなす許容幅（絶対値。既定は完全一致）
const mapId = Number(arg("--map", "1")) || 1;
const source = arg("--source", "scrcpy");
const AUDIT_ACTOR = arg("--actor", "scrcpy-auto");
if (!cardsPath) { console.error("usage: node apply-cards.mjs --cards <file> [--apply] [--move-existing] [--create-new] [--include-fuzzy] [--force] [--power-tol N] [--map N] [--objects <file>]"); process.exit(1); }

const esc = (s) => String(s).replace(/'/g, "''");
const gidClean = (v) => (v == null ? null : (String(v).replace(/[^0-9]/g, "") || null));
const num = (v) => (v == null || v === "" ? null : (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null));
function normPower(v) { if (v == null) return null; const n = Number(String(v).replace(/[,\s]/g, "")); return Number.isFinite(n) && n >= 0 ? Math.round(n) : null; }
// ★アプリ仕様＝文字列: 溶鉱炉 "1"〜"30" / ファイアクリスタル "FC1"〜"FC10"（そのまま保存）。
const fcClean = (v) => { if (v == null || v === "") return null; const s = String(v).trim(); return (/^([1-9]|[12][0-9]|30)$/.test(s) || /^FC([1-9]|10)$/i.test(s)) ? s : null; };

// PowerShell が書いたJSONは BOM 付きになりがち（Set-Content -Encoding utf8 / Out-File）。素の JSON.parse は落ちるので剥がす。
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));
const rawCards = extractRows(readJson(cardsPath));
const skippedNoCoord = [];
const cards = rawCards.map((c) => ({
  name: cleanName(stripTag(c.name ?? "")),
  power: normPower(c.power),
  gameId: gidClean(c.gameId ?? c.game_id),
  x: num(c.x ?? c.anchorX ?? c.anchor_x), y: num(c.y ?? c.anchorY ?? c.anchor_y),
  fcLevel: fcClean(c.fcLevel ?? c.fc_level),
  card: c.card ?? c.file ?? null,   // 元画像ファイル名があれば追跡用に保持
})).filter((c) => {
  if (!(c.name || c.gameId)) return false;
  if (c.x == null || c.y == null) { skippedNoCoord.push(c); return false; }
  return true;
});

// 同じ都市を撮り直した重複カードを畳む。★これが残ると、2枚目は照合済みIDが埋まっているせいで
//   「DBに居ない＝新規」と誤判定され、重複登録に化ける。座標まで一致＝同じカードなので黙って畳み、
//   同名で座標が違うもの（読み違い/別人の可能性）は畳まずに要確認として残す。
const seenCard = new Map(), dupSkipped = [], dupConflicts = [];
const cardsDedup = [];
for (const c of cards) {
  const nk = toHalf(c.name).trim();
  const key = `${c.gameId ?? nk}|${c.x}|${c.y}`;
  if (seenCard.has(key)) { dupSkipped.push(c); continue; }
  const other = cardsDedup.find((p) => (p.gameId ?? toHalf(p.name).trim()) === (c.gameId ?? nk));
  if (other) dupConflicts.push({ name: c.name, a: `${other.x},${other.y}`, b: `${c.x},${c.y}` });
  seenCard.set(key, true); cardsDedup.push(c);
}
if (dupSkipped.length) console.log(`※ 同一カードの重複を${dupSkipped.length}件畳みました（同じ人・同じ座標）`);
if (dupConflicts.length) { console.log(`[!] 同じ人が別座標で写っています（読み違いの可能性・両方残します）`); for (const d of dupConflicts) console.log(`   ? "${d.name}": ${d.a} と ${d.b}`); }

// ★ 名前は label に入っている（member_name は未使用）。
// --objects <file> を渡すと D1 に触らずにドライランできる（APIトークン不要）。現行 objects は例えば:
//   wrangler d1 execute snw-map-gen2 --remote --json \
//     --command "SELECT id, label, game_id, power, type, anchor_x, anchor_y, w, h, fc_level, placed FROM objects" > objects.json
const objectsPath = arg("--objects");
if (objectsPath && apply) { console.error("--objects はDBに触らないドライラン専用です。反映するには CF_API_TOKEN を設定して --objects を外してください。"); process.exit(1); }
const dbData = objectsPath ? readJson(objectsPath) : await d1query("SELECT id, label, member_name, game_id, power, type, anchor_x, anchor_y, w, h, fc_level, placed FROM objects");
const objects = extractRows(dbData).map((o) => ({ ...o, member_name: o.label ?? o.member_name }));
const byId = new Map(objects.map((o) => [o.id, o]));
// --objects のときは sqlite_master を引けないので、既に両テーブルがある前提で表示だけ合わせる。
const hasHistory = objectsPath ? true : extractRows(await d1query("SELECT name FROM sqlite_master WHERE type='table' AND name='power_history'")).length > 0;
const hasAudit = objectsPath ? true : extractRows(await d1query("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_log'")).length > 0;

const { matched, fuzzy, unmatched } = matchRanking(cardsDedup, objects, { fuzzy: true });

// 緩い一致の格上げ: カードの総力とDBの総力が一致（±--power-tol）なら本人確定とみなす。
//   ※曖昧一致(*-ambiguous)は候補が複数なので格上げしない。
const promoted = [], stillFuzzy = [];
for (const f of fuzzy) {
  const powerOk = f.power != null && f.oldPower != null && Math.abs(f.power - f.oldPower) <= powerTol;
  if (f.via === "loose" && powerOk) promoted.push({ ...f, via: "loose+power" });
  else if (includeFuzzy && f.id != null && !/ambiguous/.test(f.via || "")) promoted.push({ ...f, via: f.via + "(強制)" });
  else stillFuzzy.push(f);
}
const pool = [...matched, ...promoted];

// フットプリント衝突判定: 配置先が他オブジェクト(placed=1)の占有セルと重なるか。
//   anchor は最小角なので占有は x..x+w-1 / y..y+h-1。
const rect = (x, y, w, h) => ({ x0: x, y0: y, x1: x + (w || 1) - 1, y1: y + (h || 1) - 1 });
const overlaps = (a, b) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
// ★同一実行内の移動を占有計算に反映する。実行前のDB状態で固定すると「Aをどかしてから空いた場所にBを置く」が
//   永久にできない（実測: スマートEXの手入力座標が1マスずれており、それを直さないとフェード240yを置けなかった）。
//   手順: ①動かす人を先に確定 → ②その人の"元の場所"は空くものとして占有マップから除く →
//        ③衝突で弾かれた人はその場に留まるので占有マップに戻して再判定（変化が無くなるまで繰り返す）。
const skippedPlaced = [];
const plans = pool.map((m) => {
  const db = byId.get(m.id);
  const placedNow = (m.placed == null ? 1 : m.placed) === 1;
  const coordDiff = m.x !== m.dbX || m.y !== m.dbY;
  const wantCoord = !placedNow || (coordDiff && moveExisting);
  if (placedNow && coordDiff && !moveExisting) skippedPlaced.push({ ...m, from: `${m.dbX},${m.dbY}`, to: `${m.x},${m.y}` });
  return { m, placedNow, wantCoord, target: wantCoord ? rect(m.x, m.y, db?.w, db?.h) : null };
});

const blocked = new Set();
const conflictInfo = new Map();   // ★弾かれた人は次パスの対象から外れるので、理由はここに貯める（パス毎に消すと報告から消える）
let claimed = [], occupied = [];
for (let pass = 0; pass < 6; pass++) {
  const movers = plans.filter((p) => p.wantCoord && !blocked.has(p.m.id));
  const moverIds = new Set(movers.map((p) => p.m.id));
  occupied = objects.filter((o) => (o.placed == null ? 1 : o.placed) === 1 && !moverIds.has(o.id))
    .map((o) => ({ id: o.id, name: o.member_name, r: rect(o.anchor_x ?? 0, o.anchor_y ?? 0, o.w, o.h) }));
  claimed = [];
  let changed = false;
  for (const p of movers) {
    const hit = [...occupied, ...claimed].find((o) => o.id !== p.m.id && overlaps(p.target, o.r));
    if (hit && !force) { conflictInfo.set(p.m.id, { ...p.m, with: hit.name, withId: hit.id }); blocked.add(p.m.id); changed = true; }
    else claimed.push({ id: p.m.id, name: p.m.dbName, r: p.target });
  }
  if (!changed) break;
}
const conflicts = plans.filter((p) => p.wantCoord && blocked.has(p.m.id)).map((p) => conflictInfo.get(p.m.id));

const placements = [], moves = [], powerOnly = [];
for (const p of plans) {
  const m = p.m;
  const sets = [];
  if (m.power != null && m.power !== m.oldPower) sets.push({ col: "power", sql: `power = ${m.power}` });
  if (m.seedGameId && m.gameId) sets.push({ col: "game_id", sql: `game_id = '${esc(m.gameId)}'` });
  if (m.rename) sets.push({ col: "label", sql: `label = '${esc(toHalf(m.name).slice(0, 100))}'` });
  if (m.fcLevel && String(m.fcLevel) !== String(m.dbFc ?? "")) sets.push({ col: "fc_level", sql: `fc_level = '${esc(m.fcLevel)}'` });

  const doCoord = p.wantCoord && !blocked.has(m.id);
  if (doCoord) sets.push({ col: "coords", sql: `anchor_x = ${m.x}, anchor_y = ${m.y}, placed = 1` });

  if (!sets.length) continue;
  const rec = { m, sets, doCoord, wasPlaced: p.placedNow, changePower: sets.some((s) => s.col === "power") };
  if (doCoord && !p.placedNow) placements.push(rec);
  else if (doCoord) moves.push(rec);
  else powerOnly.push(rec);
}
const actions = [...placements, ...moves, ...powerOnly];

// 新規登録(--create-new)もカードの座標に置くので、同じく衝突を見る（重なる分は登録しない）。
//   ★同名カードが別座標で複数あった人は、片方が既に既存メンバーに一致している＝新規ではない。
//     ここで弾かないと「読み違えた座標の2枚目」が本人のクローンとして登録されてしまう。
const dupNames = new Set(dupConflicts.map((d) => toHalf(d.name).trim()));
const newOk = [], newConflict = [], dupBlocked = [];
for (const u of unmatched) {
  if (dupNames.has(toHalf(u.name).trim())) { dupBlocked.push(u); continue; }
  const r = rect(u.x, u.y, 2, 2);
  const hit = [...occupied, ...claimed].find((o) => overlaps(r, o.r));
  if (hit && !force) newConflict.push({ ...u, with: hit.name, withId: hit.id });
  else { newOk.push(u); claimed.push({ id: null, name: u.name, r }); }
}

console.log(`cards=${cards.length}  一致=${matched.length}  総力で確定=${promoted.filter((p) => p.via === "loose+power").length}  要確認=${stillFuzzy.length}  未一致=${unmatched.length}`);
if (skippedNoCoord.length) console.log(`※ 座標なしで無視: ${skippedNoCoord.length}件（カード読み取りでX/Yが取れていない）`);

console.log(`\n[1] 新規配置(未配置→placed=1): ${placements.length}件${apply ? "" : "  ※ドライラン"}`);
for (const a of placements) console.log(`   id=${a.m.id} ${a.m.dbName} → @${a.m.x},${a.m.y}  [${a.sets.map((s) => s.col).join("+")}]${a.m.via !== "gameid" && a.m.via !== "exact" ? " (" + a.m.via + ")" : ""}`);

console.log(`\n[2] 座標修正(配置済み): ${moves.length}件${moveExisting ? "" : "（--move-existing 未指定のため対象外）"}`);
for (const a of moves) console.log(`   id=${a.m.id} ${a.m.dbName}: ${a.m.dbX},${a.m.dbY} → ${a.m.x},${a.m.y}`);
for (const s of skippedPlaced) console.log(`   - id=${s.id} ${s.dbName}: ${s.from} → ${s.to}  ※配置済みなので動かさない（--move-existing で反映）`);

if (powerOnly.length) { console.log(`\n[3] 座標以外のみ更新: ${powerOnly.length}件`); for (const a of powerOnly) console.log(`   id=${a.m.id} ${a.m.dbName} [${a.sets.map((s) => s.col).join("+")}]`); }
if (conflicts.length) { console.log(`\n[!] 配置衝突: ${conflicts.length}件（既存と重なるので配置しない。--force で強行）`); for (const c of conflicts) console.log(`   × ${c.dbName} @${c.x},${c.y} は id=${c.withId} "${c.with}" と重なる`); }
if (stillFuzzy.length) { console.log(`\n[!] 要確認(緩い/曖昧・総力も不一致): ${stillFuzzy.length}件`); for (const f of stillFuzzy) console.log(`   ? "${f.name}"(総力${f.power ?? "?"}) → id=${f.id} "${f.dbName}"(DB総力${f.oldPower ?? "?"}) [${f.via}]`); }
if (unmatched.length) {
  console.log(`\n[!] DBに居ない: ${unmatched.length}件`);
  for (const u of newOk) console.log(`   ✗ "${u.name}" @${u.x},${u.y} 総力=${u.power ?? "?"}`);
  for (const u of newConflict) console.log(`   × "${u.name}" @${u.x},${u.y} は id=${u.withId} "${u.with}" と重なる（登録しない。--force で強行）`);
  for (const u of dupBlocked) console.log(`   × "${u.name}" @${u.x},${u.y} は同名カードが別座標にもある重複（本人は別カードで一致済み。登録しない）`);
  console.log(createNew ? `   → --create-new: この座標でCITY新規登録(placed=1)  対象${newOk.length}件` : `   → 登録するには --create-new`);
}

if (apply) {
  if (actions.length) {
    // D1 REST は BEGIN/COMMIT 不可。1回の /query 呼び出しが暗黙に原子的。
    const s = [];
    for (const a of actions) s.push(`UPDATE objects SET ${a.sets.map((x) => x.sql).join(", ")} WHERE id = ${a.m.id};`);
    for (let i = 0; i < s.length; i += 50) await d1query(s.slice(i, i + 50).join("\n"));
    console.log(`\n✅ 反映: 配置${placements.length}件 / 座標修正${moves.length}件 / その他${powerOnly.length}件`);
  }
  // 総力を更新した人だけ履歴を1点（日次スナップショットは apply-ranking 側の役目。ここでは二重に打たない）
  if (hasHistory) {
    const hs = actions.filter((a) => a.changePower).map((a) => `INSERT INTO power_history (object_id, power, source) VALUES (${a.m.id}, ${a.m.power}, '${esc(source)}');`);
    for (let i = 0; i < hs.length; i += 50) await d1query(hs.slice(i, i + 50).join("\n"));
    if (hs.length) console.log(`✅ 履歴: ${hs.length}件（総力が動いた人のみ）`);
  }
  if (createNew && newOk.length) {
    // INSERT と last_insert_rowid() の履歴は同じ呼び出しに入れる必要があるので、人単位でまとめて送る。
    const groups = newOk.map((u) => {
      const nm = esc(toHalf(u.name).slice(0, 100));
      const g = u.gameId ? `'${esc(u.gameId)}'` : "NULL";
      const p = u.power ?? "NULL";
      const fc = u.fcLevel ? `'${esc(u.fcLevel)}'` : "NULL";
      const g1 = [`INSERT INTO objects (map_id, type, anchor_x, anchor_y, w, h, label, game_id, fc_level, power, placed) VALUES (${mapId}, 'CITY', ${u.x}, ${u.y}, 2, 2, '${nm}', ${g}, ${fc}, ${p}, 1);`];
      if (u.power != null && hasHistory) g1.push(`INSERT INTO power_history (object_id, power, source) VALUES (last_insert_rowid(), ${u.power}, '${esc(source)}');`);
      return g1;
    });
    for (let i = 0; i < groups.length; i += 25) await d1query(groups.slice(i, i + 25).flat().join("\n"));
    console.log(`✅ 新規登録: ${newOk.length}件（カードの座標に配置）`);
  }
  // ★編集履歴(audit_log): 配置/移動は対象ごとに1行（キーはアプリ準拠「X」「Y」）＋実行要約1行。
  if (audit && hasAudit) {
    const A = [];
    for (const a of actions) {
      const cols = a.sets.map((s) => s.col);
      const d = {};
      if (cols.includes("coords")) { d["X"] = [a.m.dbX ?? null, a.m.x]; d["Y"] = [a.m.dbY ?? null, a.m.y]; if (!a.wasPlaced) d["配置"] = [0, 1]; }
      if (cols.includes("label")) d["名前"] = [a.m.dbName ?? null, toHalf(a.m.name).slice(0, 100)];
      if (cols.includes("game_id")) d["ゲームID"] = [a.m.dbGameId ?? null, a.m.gameId ?? null];
      if (cols.includes("fc_level")) d["FCレベル"] = [a.m.dbFc ?? null, a.m.fcLevel ?? null];
      if (!Object.keys(d).length) continue;   // 純総力更新は要約に集約
      A.push(`INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail) VALUES ('${esc(AUDIT_ACTOR)}', 'update', 'object', '${a.m.id}', '${esc(a.m.dbName ?? "")}', '${esc(JSON.stringify(d))}');`);
    }
    if (createNew) for (const u of newOk) {
      const d = { created: { label: toHalf(u.name).slice(0, 100), power: u.power ?? null, game_id: u.gameId ?? null, fc_level: u.fcLevel ?? null, x: u.x, y: u.y, placed: 1 } };
      const detail = esc(JSON.stringify(d)), nm = esc(toHalf(u.name).slice(0, 100));
      if (u.gameId) A.push(`INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail) SELECT '${esc(AUDIT_ACTOR)}','create','object', CAST(id AS TEXT), label, '${detail}' FROM objects WHERE game_id='${esc(u.gameId)}';`);
      else A.push(`INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail) SELECT '${esc(AUDIT_ACTOR)}','create','object', CAST(MAX(id) AS TEXT), '${nm}', '${detail}' FROM objects WHERE label='${nm}';`);
    }
    const summary = { source, cards: cards.length, placed: placements.length, moved: moves.length, power_updated: actions.filter((a) => a.changePower).length, created: createNew ? newOk.length : 0, conflicts: conflicts.length + newConflict.length, needs_review: stillFuzzy.length };
    A.push(`INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail) VALUES ('${esc(AUDIT_ACTOR)}', 'sync', 'cards', NULL, '都市カード自動配置', '${esc(JSON.stringify(summary))}');`);
    for (let i = 0; i < A.length; i += 50) await d1query(A.slice(i, i + 50).join("\n"));
    console.log(`✅ 監査ログ(audit_log): ${A.length}件（個別${A.length - 1}＋要約1、actor='${AUDIT_ACTOR}'）`);
  }
} else {
  console.log(`\n※ ドライラン。反映は --apply（配置済みの座標修正は --move-existing、未登録は --create-new）`);
}

fs.writeFileSync("apply-cards-report.json", JSON.stringify({
  placements: placements.map((a) => ({ ...a.m, cols: a.sets.map((s) => s.col) })),
  moves: moves.map((a) => ({ ...a.m, cols: a.sets.map((s) => s.col) })),
  powerOnly: powerOnly.map((a) => ({ ...a.m, cols: a.sets.map((s) => s.col) })),
  skippedPlaced, conflicts, newConflict, dupBlocked, dupSkipped, dupConflicts,
  needsReview: stillFuzzy, notInDb: newOk, skippedNoCoord, hasHistory, source,
}, null, 2));
console.log(`\nレポート: apply-cards-report.json`);
