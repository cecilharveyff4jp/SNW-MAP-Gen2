// GET /api/admin/users — ユーザー一覧（オーナー専用）。
import { requireOwner, json, type AdminEnv } from "./_shared";

export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireOwner(context);
  if (denied) return denied;

  const { results } = await context.env.DB.prepare(
    "SELECT email, display_name, status, role, requested_at, decided_at FROM users ORDER BY (status = 'pending') DESC, requested_at DESC"
  ).all();
  return json(results ?? []);
};
