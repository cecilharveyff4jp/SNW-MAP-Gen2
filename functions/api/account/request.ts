// POST /api/account/request — 編集権限の申請。Access 配下に置く。
// ログインメール（Access検証済み）＋ 表示名 を users に upsert（status=pending）。
import { getEmail, json, type AdminEnv } from "../admin/_shared";

export const onRequestPost: PagesFunction<AdminEnv> = async (context) => {
  const email = await getEmail(context);
  if (!email) return json({ error: "login required" }, 401);

  let body: { displayName?: string } = {};
  try {
    body = (await context.request.json()) as { displayName?: string };
  } catch {
    // body 無しでも申請は受ける
  }
  const displayName = (body.displayName ?? "").toString().trim().slice(0, 60) || null;

  // 既に承認済みなら承認のまま、それ以外は pending に。
  await context.env.DB.prepare(
    "INSERT INTO users (email, display_name, status, role, requested_at) " +
      "VALUES (?, ?, 'pending', 'editor', datetime('now')) " +
      "ON CONFLICT(email) DO UPDATE SET " +
      "display_name = excluded.display_name, " +
      "status = CASE WHEN users.status = 'approved' THEN 'approved' ELSE 'pending' END, " +
      "requested_at = datetime('now')"
  )
    .bind(email, displayName)
    .run();

  return json({ ok: true });
};
