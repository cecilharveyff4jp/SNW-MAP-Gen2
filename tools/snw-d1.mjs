#!/usr/bin/env node
// Cloudflare D1 REST クライアント（読み書き）。このチャット環境からでも開発PCからでも動く。
// 認証情報は環境変数、または tools/.env から取得:
//   CF_API_TOKEN    D1:Edit 権限を持つ API トークン（必須）
//   CF_ACCOUNT_ID   Cloudflare アカウントID（省略時はトークンから自動取得）
//   CF_DATABASE_ID  D1 データベースID（既定 = snw-map-gen2 の 360d346e-...）
//
// ★ tools/.env に書いておけば毎回 export しなくてよい（tools/ ごと git 管理外）。書式は tools/.env.example 参照。
//    環境変数が既にあればそちらが優先。トークンはチャットにも履歴にも残さないこと。
//
// ライブラリとして:  import { d1query } from "./snw-d1.mjs"
// CLI として:
//   node snw-d1.mjs "SELECT id, member_name, power, type FROM objects"
//   node snw-d1.mjs --file update.sql

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// tools/.env を読む（KEY=VALUE / #コメント / 前後の引用符は剥がす）。既存の環境変数は上書きしない。
function loadDotEnv() {
  const p = path.join(path.dirname(fileURLToPath(import.meta.url)), ".env");
  let text;
  try { text = fs.readFileSync(p, "utf8"); } catch { return; }
  for (const line of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m || /^\s*#/.test(line)) continue;
    const key = m[1];
    let val = m[2].trim().replace(/\s+#.*$/, "");
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (val && process.env[key] == null) process.env[key] = val;
  }
}
loadDotEnv();

const API_TOKEN = process.env.CF_API_TOKEN;
const DATABASE_ID = process.env.CF_DATABASE_ID || "360d346e-e617-4129-8910-0820420b5b0b";
let ACCOUNT_ID = process.env.CF_ACCOUNT_ID || null;

const API = "https://api.cloudflare.com/client/v4";

async function resolveAccountId() {
  if (ACCOUNT_ID) return ACCOUNT_ID;
  const res = await fetch(`${API}/accounts`, { headers: { Authorization: `Bearer ${API_TOKEN}` } });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(`アカウント取得に失敗: ${(data.errors || []).map((e) => e.message).join("; ") || res.statusText}`);
  }
  // ★D1:Edit だけのトークンはアカウント一覧を読めず、403ではなく「空のリスト」が返る。
  //   その場合は自動取得を諦めて CF_ACCOUNT_ID を明示してもらう（トークンの権限を広げるより安全）。
  if (!data.result?.length) throw new Error(
    "このトークンではアカウント一覧を取得できません（D1:Edit のみの権限だと空で返ります）。\n" +
    "  tools/.env に CF_ACCOUNT_ID=<アカウントID> を追記してください。\n" +
    "  アカウントIDは Cloudflare ダッシュボードのURL https://dash.cloudflare.com/<ここ>/... で確認できます。");
  ACCOUNT_ID = data.result[0].id;
  return ACCOUNT_ID;
}

/** D1 に SQL を投げて結果を返す。複数文（; 区切り）も可。 */
export async function d1query(sql, params = []) {
  if (!API_TOKEN) throw new Error("CF_API_TOKEN がありません。tools/.env に CF_API_TOKEN=... を書くか、環境変数で設定してください（書式は tools/.env.example）");
  const acct = await resolveAccountId();
  const url = `${API}/accounts/${acct}/d1/database/${DATABASE_ID}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    const msg = (data.errors && data.errors.map((e) => e.message).join("; ")) || res.statusText;
    throw new Error(`D1 API error (${res.status}): ${msg}`);
  }
  return data; // { result: [ { results:[...], success, meta } ], success, errors, messages }
}

// --- CLI ---
// ★Windows対応: `file://${process.argv[1]}` だと "file://C:\..." になり、import.meta.url の
//   "file:///C:/..." と一致しないため CLI が無言で何もせず終了する。pathToFileURL で正規化する。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fileFlag = process.argv.indexOf("--file");
  const sql = fileFlag >= 0
    ? fs.readFileSync(process.argv[fileFlag + 1], "utf8")
    : process.argv.slice(2).join(" ");
  if (!sql.trim()) { console.error('usage: node snw-d1.mjs "SQL"  |  --file file.sql'); process.exit(1); }
  d1query(sql).then((data) => {
    const r = data.result?.[0];
    if (r?.results) console.log(JSON.stringify(r.results, null, 2));
    console.error(`ok. rows=${r?.results?.length ?? 0} changes=${r?.meta?.changes ?? 0} duration=${r?.meta?.duration ?? "?"}ms`);
  }).catch((e) => { console.error(String(e.message || e)); process.exitCode = 1; });  // exit()だとfetch後処理中でlibuvがassertする
}
