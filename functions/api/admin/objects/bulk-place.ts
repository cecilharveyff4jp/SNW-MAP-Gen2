// POST /api/admin/objects/bulk-place — 複数オブジェクトの座標を一括更新（自動配置）。編集権限。
import { requireEditor, json, getEmail, writeAudit, type AdminEnv } from "../_shared";

interface Placement { id: number; anchorX: number; anchorY: number }

export const onRequestPost: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;
  let body: { mapId?: number; placements?: Placement[] } = {};
  try { body = (await context.request.json()) as { mapId?: number; placements?: Placement[] }; } catch { return json({ error: "invalid JSON" }, 400); }
  const mapId = Number(body.mapId);
  const ps = Array.isArray(body.placements) ? body.placements : [];
  if (!mapId || ps.length === 0) return json({ error: "missing mapId or placements" }, 400);
  if (ps.length > 2000) return json({ error: "too many placements" }, 400);
  try {
    const stmts = ps.map((p) => context.env.DB.prepare(
      "UPDATE objects SET anchor_x = ?, anchor_y = ?, placed = 1 WHERE id = ? AND map_id = ?"
    ).bind(Math.round(p.anchorX), Math.round(p.anchorY), Number(p.id), mapId));
    const res = await context.env.DB.batch(stmts);
    let updated = 0;
    for (const r of res) updated += (r.meta?.changes ?? 0);
    await writeAudit(context.env, await getEmail(context), "bulk_place", "map", mapId, "自動配置: " + ps.length + "都市");
    return json({ ok: true, updated });
  } catch (e) { return json({ error: (e as Error).message }, 500); }
};
