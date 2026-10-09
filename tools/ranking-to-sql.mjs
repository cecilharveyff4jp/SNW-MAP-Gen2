#!/usr/bin/env node
// ランキング/郊外カード/プロフィール抽出 + 現行objects → 更新SQLと照合レポートを生成（オフライン）。
// 生成した update.sql / new-cities.sql を wrangler で流せば反映される。
//
// 使い方:
//   node ranking-to-sql.mjs --ranking data.json --objects objects.json --out ./out
//   objects.json: wrangler d1 execute snw-map-gen2 --remote --json \
//     --command "SELECT id, member_name, game_id, power, type, anchor_x, anchor_y, fc_level, placed FROM objects" > objects.json
//
// 入力(data.json)の各キーは任意: name, power, gameId, x, y, fcLevel
// 出力: update.sql / new-cities.sql / coords.sql(座標同期・任意) / review.sql / report.txt / matches.json
// オプション: --source scrcpy(既定) / --no-history / --min-power N

import fs from "node:fs";
import path from "node:path";
import { matchRanking, extractRows, cleanName, stripTag, toHalf } from "./lib-norm.mjs";

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }
const rankingPath = arg("--ranking");
const objectsPath = arg("--objects");
const outDir = arg("--out", "./out");
const minPower = Number(arg("--min-power", "0")) || 0;
const withHistory = !process.argv.includes("--no-history");
const source = arg("--source", "scrcpy");
if (!rankingPath || !objectsPath) { console.error("usage: node ranking-to-sql.mjs --ranking <file> --objects <file> [--out dir]"); process.exit(1); }

const esc = (s) => String(s).replace(/'/g, "''");
const gidClean = (v) => (v == null ? null : (String(v).replace(/[^0-9]/g, "") || null));
const num = (v) => (v == null || v === "" ? null : (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null));
const fcClean = (v) => { if (v == null || v === "") return null; const s = String(v).trim(); return (/^([1-9]|[12][0-9]|30)$/.test(s) || /^FC([1-9]|10)$/.test(s)) ? s : null; };
function normPower(v) { if (v == null) return null; const n = Number(String(v).replace(/[,\s]/g, "")); return Number.isFinite(n) && n >= 0 ? Math.round(n) : null; }

function readMaybeCsv(p) {
  const raw = fs.readFileSync(p, "utf8").replace(/^﻿/, "").trim();
  if (raw.startsWith("[") || raw.startsWith("{")) return JSON.parse(raw);
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const first = lines[0].split(",").map((s) => s.trim().toLowerCase());
  const hasHeader = first.includes("name") || first.includes("power");
  const cols = hasHeader ? first : null;
  return (hasHeader ? lines.slice(1) : lines).map((line) => {
    const parts = line.split(",");
    if (cols) { const o = {}; parts.forEach((v, i) => (o[cols[i]] = v.trim())); return o; }
    const power = parts.pop().trim(); return { name: parts.join(",").trim(), power };
  });
}

let ranking = extractRows(readMaybeCsv(rankingPath));
ranking = ranking.map((r) => ({
  rank: r.rank ?? null, name: cleanName(stripTag(r.name ?? "")), power: normPower(r.power),
  gameId: gidClean(r.gameId ?? r.game_id), x: num(r.x ?? r.anchorX), y: num(r.y ?? r.anchorY), fcLevel: fcClean(r.fcLevel ?? r.fc_level),
})).filter((r) => (r.name || r.gameId) && (r.power == null || r.power >= minPower));

// ★ 名前は label に入っている（member_name は未使用）。label を照合名として使う。
const objRaw = extractRows(JSON.parse(fs.readFileSync(objectsPath, "utf8")));
const objects = objRaw.map((o) => ({
  id: o.id, member_name: o.label ?? o.member_name ?? o.memberName ?? null, game_id: o.game_id ?? o.gameId ?? null,
  power: o.power ?? null, type: o.type ?? null, anchor_x: o.anchor_x ?? o.anchorX ?? null, anchor_y: o.anchor_y ?? o.anchorY ?? null,
  fc_level: o.fc_level ?? o.fcLevel ?? null, placed: o.placed ?? 1,
}));

const { matched, fuzzy, unmatched, dbOnly } = matchRanking(ranking, objects, { fuzzy: true });

const actions = [];       // power/改名/ID補完/FC
const coordProposals = []; // 既存座標差分（coords.sql に別出し）
for (const m of matched) {
  const sets = [];
  const changePower = m.power != null && m.power !== m.oldPower;
  if (changePower) sets.push({ col: "power", sql: `power = ${m.power}` });
  if (m.seedGameId && m.gameId) sets.push({ col: "game_id", sql: `game_id = '${esc(m.gameId)}'` });
  if (m.rename) sets.push({ col: "label", sql: `label = '${esc(toHalf(m.name).slice(0, 100))}'` });
  if (m.fcLevel && String(m.fcLevel) !== String(m.dbFc ?? "")) sets.push({ col: "fc_level", sql: `fc_level = '${esc(m.fcLevel)}'` });
  if (m.x != null && m.y != null && (m.x !== m.dbX || m.y !== m.dbY || m.placed === 0)) coordProposals.push(m);
  if (sets.length) actions.push({ m, sets, changePower });
}

fs.mkdirSync(outDir, { recursive: true });

const updLines = actions.map((a) => {
  let line = `UPDATE objects SET ${a.sets.map((s) => s.sql).join(", ")} WHERE id = ${a.m.id}; -- ${esc(a.m.dbName)} [${a.sets.map((s) => s.col).join("+")}]`;
  if (a.changePower && withHistory) line += `\nINSERT INTO power_history (object_id, power, source) VALUES (${a.m.id}, ${a.m.power}, '${esc(source)}');`;
  return line;
}).join("\n");
fs.writeFileSync(path.join(outDir, "update.sql"),
  `-- power更新/改名/ID補完/FC ${actions.length}件${withHistory ? "（総力変更はpower_historyにも追記）" : ""}\n-- 適用: wrangler d1 execute snw-map-gen2 --remote --file=update.sql\n` +
  (actions.length ? `${updLines}\n` : `-- （更新なし）\n`));

const coordLines = coordProposals.map((m) => `UPDATE objects SET anchor_x = ${m.x}, anchor_y = ${m.y}, placed = 1 WHERE id = ${m.id}; -- ${esc(m.dbName)} (${m.dbX ?? "?"},${m.dbY ?? "?"}→${m.x},${m.y})`).join("\n");
fs.writeFileSync(path.join(outDir, "coords.sql"),
  `-- 既存都市の座標同期（確認のうえ適用）${coordProposals.length}件\n-- 適用: wrangler d1 execute snw-map-gen2 --remote --file=coords.sql\n` +
  (coordProposals.length ? `${coordLines}\n` : `-- （差分なし）\n`));

const newLines = unmatched.map((u) => {
  const nm = esc(toHalf(u.name).slice(0, 100));
  const g = u.gameId ? `'${esc(u.gameId)}'` : "NULL";
  const p = u.power ?? "NULL";
  const fc = u.fcLevel ? `'${esc(u.fcLevel)}'` : "NULL";
  const placed = u.x != null && u.y != null ? 1 : 0;
  const ax = placed ? u.x : 0, ay = placed ? u.y : 0;
  let line = `INSERT INTO objects (map_id, type, anchor_x, anchor_y, w, h, label, game_id, fc_level, power, placed) VALUES (1, 'CITY', ${ax}, ${ay}, 2, 2, '${nm}', ${g}, ${fc}, ${p}, ${placed}); -- ${esc(u.name)}${placed ? " @" + u.x + "," + u.y : " (未配置)"}`;
  if (u.power != null && withHistory) line += `\nINSERT INTO power_history (object_id, power, source) VALUES (last_insert_rowid(), ${u.power}, '${esc(source)}');`;
  return line;
}).join("\n");
fs.writeFileSync(path.join(outDir, "new-cities.sql"),
  `-- 未一致メンバーをCITY登録 ${unmatched.length}件（座標ありは配置済み・無しは未配置プール）\n-- 適用: wrangler d1 execute snw-map-gen2 --remote --file=new-cities.sql\n` +
  (unmatched.length ? `${newLines}\n` : `-- （新規なし）\n`));

fs.writeFileSync(path.join(outDir, "review.sql"), `-- 緩い/曖昧一致（確認してから）\n` + fuzzy.map((f) => `-- "${esc(f.name)}" → id=${f.id} "${esc(f.dbName ?? "")}" [${f.via}]`).join("\n") + "\n");

const L = [];
L.push(`# 更新レポート ${new Date().toISOString()}`);
L.push(`ranking=${ranking.length} matched=${matched.length} fuzzy=${fuzzy.length} unmatched=${unmatched.length} DB残り=${dbOnly.length}`);
L.push(`\n## 更新 → update.sql (${actions.length})`);
for (const a of actions) L.push(`  ・id=${a.m.id} ${a.m.dbName} [${a.sets.map((s) => s.col).join("+")}]${a.m.rename ? " 改名→" + a.m.name : ""}`);
L.push(`\n## 座標差分 → coords.sql (${coordProposals.length})  ※確認して適用`);
for (const m of coordProposals) L.push(`  ・id=${m.id} ${m.dbName}: ${m.dbX ?? "?"},${m.dbY ?? "?"}${m.placed === 0 ? "(未配置)" : ""} → ${m.x},${m.y}`);
L.push(`\n## 新規 → new-cities.sql (${unmatched.length})`);
for (const u of unmatched) L.push(`  ✗ "${u.name}"${u.gameId ? " ID=" + u.gameId : ""}${u.x != null ? " @" + u.x + "," + u.y : " (座標なし)"} power=${u.power ?? "?"}${u.fcLevel ? " FC" + u.fcLevel : ""}`);
L.push(`\n## 要確認 (${fuzzy.length}) / ランキング未出現 (${dbOnly.length})`);
for (const f of fuzzy) L.push(`  ? "${f.name}" → id=${f.id} "${f.dbName ?? ""}" [${f.via}]`);
for (const o of dbOnly) L.push(`  - id=${o.id} "${o.member_name}"${o.game_id ? " ID=" + o.game_id : ""}`);
fs.writeFileSync(path.join(outDir, "report.txt"), L.join("\n") + "\n");
fs.writeFileSync(path.join(outDir, "matches.json"), JSON.stringify({ actions: actions.map((a) => ({ ...a.m, cols: a.sets.map((s) => s.col) })), coordProposals, fuzzy, unmatched, dbOnly }, null, 2));

console.log(`done. 更新=${actions.length} 座標差分=${coordProposals.length} 新規=${unmatched.length} 要確認=${fuzzy.length} DB残り=${dbOnly.length}`);
console.log(`out: ${path.resolve(outDir)}`);
