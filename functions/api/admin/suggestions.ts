// GET /api/admin/suggestions — 変更提案一覧（承認済み編集者）。
import { requireEditor, json, type AdminEnv } from "./_shared";

interface Row { id: number; object_id: number | null; map_id: number | null; object_label: string | null; field: string; value: string | null; comment: string | null; proposer_email: string | null; proposer_name: string | null; status: string; created_at: string }

export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;
  const { results } = await context.env.DB.prepare(
    "SELECT id, object_id, map_id, object_label, field, value, comment, proposer_email, proposer_name, status, created_at FROM suggestions ORDER BY (status = 'open') DESC, id DESC"
  ).all<Row>();
  const out = (results ?? []).map((r) => ({ id: r.id, objectId: r.object_id, mapId: r.map_id, objectLabel: r.object_label, field: r.field, value: r.value, comment: r.comment, proposerEmail: r.proposer_email, proposerName: r.proposer_name, status: r.status, createdAt: r.created_at }));
  return json(out);
};
