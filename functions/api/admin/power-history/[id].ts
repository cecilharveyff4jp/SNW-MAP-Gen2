// DELETE /api/admin/power-history/:id — 誤った履歴を削除（編集権限）。
import { requireEditor, json, type AdminEnv } from "../_shared";

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
