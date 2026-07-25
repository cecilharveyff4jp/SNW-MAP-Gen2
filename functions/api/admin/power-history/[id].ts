// DELETE /api/admin/power-history/:id — 誤った履歴を削除（編集権限）。
import { requireEditor, json, type AdminEnv } from "../_shared";

// PUT /api/admin/power-history/:id — 履歴の数値（や日時）を修正（編集権限）。
export const onRequestPut: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return json({ error: "invalid id" }, 400);
  let body: { power?: unknown; recordedAt?: unknown } = {};
  try { body = (await context.request.json()) as { power?: unknown; recordedAt?: unknown }; } catch { /* noop */ }
  const sets: string[] = []; const binds: unknown[] = [];
  if (body.power != null && body.power !== "") {
    const n = Number(body.power);
    if (!Number.isFinite(n) || n < 0) return json({ error: "invalid power" }, 400);
    sets.push("power = ?"); binds.push(Math.round(n));
  }
  if (typeof body.recordedAt === "string" && body.recordedAt.trim()) {
    sets.push("recorded_at = ?"); binds.push(body.recordedAt.trim());
  }
  if (sets.length === 0) return json({ error: "nothing to update" }, 400);
  binds.push(id);
  try {
    const res = await context.env.DB.prepare("UPDATE power_history SET " + sets.join(", ") + " WHERE id = ?").bind(...binds).run();
    if (res.meta.changes === 0) return json({ error: "not found" }, 404);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};

export const onRequestDelete: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return json({ error: "invalid id" }, 400);
  try {
    const res = await context.env.DB.prepare("DELETE FROM power_history WHERE id = ?").bind(id).run();
    if (res.meta.changes === 0) return json({ error: "not found" }, 404);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};
