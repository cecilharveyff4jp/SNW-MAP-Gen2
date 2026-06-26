// PUT /api/admin/users/:email — 承認状態の変更（オーナー専用）。
// body: { status: "approved" | "rejected" | "pending" }
import { requireOwner, getEmail, json, type AdminEnv } from "../_shared";

const ALLOWED = ["approved", "rejected", "pending"];

export const onRequestPut: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireOwner(context);
  if (denied) return denied;

  const target = decodeURIComponent(String(context.params.email))
    .trim()
    .toLowerCase();
  if (!target) return json({ error: "invalid email" }, 400);

  let body: { status?: string } = {};
  try {
    body = (await context.request.json()) as { status?: string };
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const status = String(body.status ?? "");
  if (!ALLOWED.includes(status)) return json({ error: "invalid status" }, 400);

  const decidedBy = await getEmail(context);
  const res = await context.env.DB.prepare(
    "UPDATE users SET status = ?, decided_at = datetime('now'), decided_by = ? WHERE email = ?"
  )
    .bind(status, decidedBy, target)
    .run();
  if (res.meta.changes === 0) return json({ error: "not found" }, 404);
  return json({ ok: true });
};
