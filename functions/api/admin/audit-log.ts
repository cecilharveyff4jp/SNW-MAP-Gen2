// GET /api/admin/audit-log — 操作履歴（オーナー専用）。
// クエリ: ?limit=50&before=<id>（before より小さいidを取得＝古い方へページング）&entity=object|map|user
import { requireOwner, json, type AdminEnv } from "./_shared";

export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireOwner(context);
  if (denied) return denied;

  const url = new URL(context.request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const before = Number(url.searchParams.get("before"));
  const entity = url.searchParams.get("entity");

  const where: string[] = [];
  const binds: unknown[] = [];
  if (Number.isFinite(before) && before > 0) { where.push("id < ?"); binds.push(before); }
  if (entity === "object" || entity === "map" || entity === "user") { where.push("entity = ?"); binds.push(entity); }
  const clause = where.length ? " WHERE " + where.join(" AND ") : "";

  try {
    const rows = await context.env.DB.prepare(
      "SELECT id, ts, actor_email, action, entity, entity_id, label, detail FROM audit_log" + clause + " ORDER BY id DESC LIMIT ?"
    ).bind(...binds, limit).all<{ id: number; ts: string; actor_email: string | null; action: string; entity: string; entity_id: string | null; label: string | null; detail: string | null }>();
    const items = (rows.results ?? []).map((r) => ({
      id: r.id,
      ts: r.ts,
      actorEmail: r.actor_email,
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id,
      label: r.label,
      detail: r.detail ? JSON.parse(r.detail) : null,
    }));
    return json({ items });
  } catch (e) {
    // テーブル未作成（マイグレ前）などは空で返す
    return json({ items: [], note: (e as Error).message });
  }
};
