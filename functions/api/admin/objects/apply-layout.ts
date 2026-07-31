// POST /api/admin/objects/apply-layout — 仮マップの都市配置を本番メインへ座標として書き戻す。編集権限。
// cityKey（game_id > member_name > label）で同定し、メインの各都市の anchor_x/y だけ更新する。
import { requireEditor, json, getEmail, writeAudit, type AdminEnv } from "../_shared";

interface Row { id: number; anchor_x: number; anchor_y: number; label: string | null; member_name: string | null; game_id: string | null }
const keyOf = (r: Row) => (r.game_id && r.game_id.trim()) || (r.member_name && r.member_name.trim()) || (r.label && r.label.trim()) || ("obj-" + r.id);

export const onRequestPost: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;
  let body: { fromMapId?: number } = {};
  try { body = (await context.request.json()) as { fromMapId?: number }; } catch { return json({ error: "invalid JSON" }, 400); }
  const fromMapId = Number(body.fromMapId);
  if (!fromMapId) return json({ error: "missing fromMapId" }, 400);
  try {
    const baseRow = await context.env.DB.prepare("SELECT id FROM maps WHERE is_base = 1 LIMIT 1").first<{ id: number }>();
    if (!baseRow) return json({ error: "base map not found" }, 404);
    const baseId = baseRow.id;
    if (baseId === fromMapId) return json({ error: "source is base map" }, 400);
    const cols = "id, anchor_x, anchor_y, label, member_name, game_id";
    const sim = await context.env.DB.prepare("SELECT " + cols + " FROM objects WHERE map_id = ? AND type = 'CITY'").bind(fromMapId).all<Row>();
    const base = await context.env.DB.prepare("SELECT " + cols + " FROM objects WHERE map_id = ? AND type = 'CITY'").bind(baseId).all<Row>();
    const baseByKey = new Map<string, Row>();
    for (const r of (base.results ?? [])) baseByKey.set(keyOf(r), r);
    const stmts: D1PreparedStatement[] = [];
    const unmatched: { key: string; label: string }[] = [];
    for (const r of (sim.results ?? [])) {
      const t = baseByKey.get(keyOf(r));
      if (!t) { unmatched.push({ key: keyOf(r), label: r.label || r.member_name || "" }); continue; }
      stmts.push(context.env.DB.prepare("UPDATE objects SET anchor_x = ?, anchor_y = ?, placed = 1 WHERE id = ?").bind(r.anchor_x, r.anchor_y, t.id));
    }
    let applied = 0;
    if (stmts.length) { const res = await context.env.DB.batch(stmts); for (const x of res) applied += (x.meta?.changes ?? 0); }
    await writeAudit(context.env, await getEmail(context), "apply_layout", "map", baseId, "配置を本番へ反映: " + applied + "都市" + (unmatched.length ? " / 未一致" + unmatched.length : ""));
    return json({ ok: true, applied, unmatched });
  } catch (e) { return json({ error: (e as Error).message }, 500); }
};
