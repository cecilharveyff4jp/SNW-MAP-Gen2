// PUT/DELETE /api/admin/suggestions/:id — 状態更新/削除（承認済み編集者）。
import { requireEditor, json, type AdminEnv } from "../_shared";

export const onRequestPut: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return json({ error: "invalid id" }, 400);
  let body: { status?: unknown } = {};
  try { body = (await context.request.json()) as typeof body; } catch { return json({ error: "invalid JSON" }, 400); }
  const status = String(body.status ?? "");
  if (!["open", "done", "rejected"].includes(status)) return json({ error: "invalid status" }, 400);
  const r = await context.env.DB.prepare("UPDATE suggestions SET status = ? WHERE id = ?").bind(status, id).run();
  if (r.meta.changes === 0) return json({ error: "not found" }, 404);
  return json({ ok: true });
};

export const onRequestDelete: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return json({ error: "invalid id" }, 400);
  await context.env.DB.prepare("DELETE FROM suggestions WHERE id = ?").bind(id).run();
  return json({ ok: true });
};
