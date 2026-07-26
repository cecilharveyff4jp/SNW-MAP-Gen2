// PUT/DELETE /api/admin/suggestions/:id — 状態更新/削除（承認済み編集者）。
import { requireEditor, json, getEmail, writeAudit, type AdminEnv } from "../_shared";

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
  const act = status === "done" ? "done" : status === "rejected" ? "reject" : "update";
  await writeAudit(context.env, await getEmail(context), act, "suggestion", id, null, { 状態: status });
  return json({ ok: true });
};

export const onRequestDelete: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return json({ error: "invalid id" }, 400);
  const prev = await context.env.DB.prepare("SELECT object_label, field FROM suggestions WHERE id = ?").bind(id).first<{ object_label: string | null; field: string | null }>();
  await context.env.DB.prepare("DELETE FROM suggestions WHERE id = ?").bind(id).run();
  await writeAudit(context.env, await getEmail(context), "delete", "suggestion", id, prev?.object_label ?? prev?.field ?? null);
  return json({ ok: true });
};
