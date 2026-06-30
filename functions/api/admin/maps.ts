// POST /api/admin/maps — マップ作成（編集権限）。
import { requireEditor, json, type AdminEnv } from "./_shared";

export const onRequestPost: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;

  let body: { name?: string; copyFrom?: number } = {};
  try { body = (await context.request.json()) as { name?: string; copyFrom?: number }; } catch { /* noop */ }
  const name = (body.name ?? "").toString().trim().slice(0, 40) || "新しいマップ";
  const copyFrom = body.copyFrom != null && Number.isFinite(Number(body.copyFrom)) ? Number(body.copyFrom) : null;

  const ord = await context.env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM maps"
  ).first<{ n: number }>();
  const res = await context.env.DB.prepare(
    "INSERT INTO maps (name, is_visible, is_base, sort_order) VALUES (?, 1, 0, ?)"
  ).bind(name, ord?.n ?? 1).run();
  const newId = res.meta.last_row_id;

  // コピー作成: 元マップの全オブジェクトをSQL一発で複製（1リクエストで高速・確実）
  if (copyFrom != null) {
    try {
      await context.env.DB.prepare(
        "INSERT INTO objects (map_id, type, anchor_x, anchor_y, w, h, label, member_name, game_id, fc_level, power, placed, note, birthday, music_ids) " +
        "SELECT ?, type, anchor_x, anchor_y, w, h, label, member_name, game_id, fc_level, power, placed, note, birthday, music_ids FROM objects WHERE map_id = ?"
      ).bind(newId, copyFrom).run();
    } catch (e) {
      return json({ id: newId, copyError: (e as Error).message }, 201);
    }
  }
  return json({ id: newId }, 201);
};
