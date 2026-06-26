// PUT/DELETE /api/admin/maps/:id — 改名/表示/並びは編集権限、削除はオーナー。
import { requireOwner, requireEditor, json, type AdminEnv } from "../_shared";

export const onRequestPut: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return json({ error: "invalid id" }, 400);

  let body: { name?: string; isVisible?: boolean; sortOrder?: number } = {};
  try { body = (await context.request.json()) as typeof body; } catch { return json({ error: "invalid JSON" }, 400); }

  const sets: string[] = [];
  const vals: unknown[] = [];
  if (typeof body.name === "string") { sets.push("name = ?"); vals.push(body.name.trim().slice(0, 40) || "マップ"); }
  if (typeof body.isVisible === "boolean") { sets.push("is_visible = ?"); vals.push(body.isVisible ? 1 : 0); }
  if (typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder)) { sets.push("sort_order = ?"); vals.push(body.sortOrder); }
  if (sets.length === 0) return json({ error: "no fields" }, 400);

  vals.push(id);
  const res = await context.env.DB.prepare("UPDATE maps SET " + sets.join(", ") + " WHERE id = ?").bind(...vals).run();
  if (res.meta.changes === 0) return json({ error: "not found" }, 404);
  return json({ ok: true });
};

export const onRequestDelete: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireOwner(context);
  if (denied) return denied;
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return json({ error: "invalid id" }, 400);

  const map = await context.env.DB.prepare("SELECT is_base FROM maps WHERE id = ?").bind(id).first<{ is_base: number }>();
  if (!map) return json({ error: "not found" }, 404);
  if (map.is_base) return json({ error: "ベースマップは削除できません" }, 400);
  const cnt = await context.env.DB.prepare("SELECT COUNT(*) AS n FROM maps").first<{ n: number }>();
  if ((cnt?.n ?? 0) <= 1) return json({ error: "最後の1枚は削除できません" }, 400);

  // D1 はカスケードが効かない場合があるので明示的に削除
  await context.env.DB.prepare("DELETE FROM objects WHERE map_id = ?").bind(id).run();
  await context.env.DB.prepare("DELETE FROM maps WHERE id = ?").bind(id).run();
  return json({ ok: true });
};
