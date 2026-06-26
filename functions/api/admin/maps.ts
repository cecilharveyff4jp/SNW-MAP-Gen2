// POST /api/admin/maps — マップ作成（編集権限）。
import { requireEditor, json, type AdminEnv } from "./_shared";

export const onRequestPost: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;

  let body: { name?: string } = {};
  try { body = (await context.request.json()) as { name?: string }; } catch { /* noop */ }
  const name = (body.name ?? "").toString().trim().slice(0, 40) || "新しいマップ";

  const ord = await context.env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM maps"
  ).first<{ n: number }>();
  const res = await context.env.DB.prepare(
    "INSERT INTO maps (name, is_visible, is_base, sort_order) VALUES (?, 1, 0, ?)"
  ).bind(name, ord?.n ?? 1).run();
  return json({ id: res.meta.last_row_id }, 201);
};
