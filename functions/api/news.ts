// GET /api/news — 同盟ニュース（操作ログから「モチベが上がる出来事」を抽出して公開）。
// 匿名化（編集者メールは出さない）。都市の: 新規加入 / 溶鉱炉レベルUP / 総力の大台突破(100M) / 改名 / 移動 を拾う。
// クエリ: ?limit=40 & before=<audit id>（古い方へページング）
import { json, type AdminEnv } from "./admin/_shared";

const fcRank = (lv: string) => (/^\d+$/.test(lv) ? parseInt(lv, 10) : 100 + parseInt(lv.replace("FC", ""), 10));
const STEP = 100_000_000; // 100M

function pair(v: unknown): [unknown, unknown] | null { return Array.isArray(v) && v.length === 2 ? [v[0], v[1]] : null; }

function toEvent(action: string, entity: string, d: Record<string, unknown> | null): Record<string, unknown> | null {
  if (entity === "music") return action === "create" ? { kind: "music" } : null;
  if (entity === "link") return action === "create" ? { kind: "link" } : null;
  // 以降は entity === "object"
  if (action === "create") return { kind: "new" };
  if (!d) return null;
  const fc = pair(d["FCレベル"]);
  if (fc && fc[1] != null) { const o = fc[0] == null ? -1 : fcRank(String(fc[0])); const n = fcRank(String(fc[1])); if (n > o) return { kind: "fc", level: String(fc[1]) }; }
  const pw = pair(d["総力"]);
  if (pw && pw[1] != null) { const o = Number(pw[0] ?? 0), n = Number(pw[1]); if (Number.isFinite(n) && n > o && Math.floor(n / STEP) > Math.floor(o / STEP)) return { kind: "power", milestoneM: Math.floor(n / STEP) * 100 }; }
  const nm = pair(d["名称"]);
  if (nm && nm[0] && nm[1] && String(nm[0]) !== String(nm[1])) return { kind: "rename", from: String(nm[0]), to: String(nm[1]) };
  return null; // 位置の移動はニュースにしない
}

export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  const url = new URL(context.request.url);
  const limit = Math.min(60, Math.max(1, Number(url.searchParams.get("limit")) || 40));
  const before = Number(url.searchParams.get("before"));
  const where = ["entity IN ('object','music','link')"];
  const binds: unknown[] = [];
  if (Number.isFinite(before) && before > 0) { where.push("id < ?"); binds.push(before); }
  try {
    // 非表示（編集者が消したニュース）の audit id を除外。テーブル未作成でも空で続行。
    let hidden = new Set<number>();
    try { const hr = await context.env.DB.prepare("SELECT audit_id FROM news_hidden").all<{ audit_id: number }>(); hidden = new Set((hr.results ?? []).map((r) => r.audit_id)); } catch { /* noop */ }

    const rows = await context.env.DB.prepare(
      "SELECT id, ts, action, entity, entity_id, label, detail FROM audit_log WHERE " + where.join(" AND ") + " ORDER BY id DESC LIMIT 400"
    ).bind(...binds).all<{ id: number; ts: string; action: string; entity: string; entity_id: string | null; label: string | null; detail: string | null }>();
    const items: Record<string, unknown>[] = [];
    for (const r of rows.results ?? []) {
      if (hidden.has(r.id)) continue;
      let d: Record<string, unknown> | null = null;
      try { d = r.detail ? JSON.parse(r.detail) : null; } catch { d = null; }
      const ev = toEvent(r.action, r.entity, d);
      if (ev) items.push({ id: r.id, ts: r.ts, name: r.label ?? "", entity: r.entity, entityId: r.entity_id, ...ev });
      if (items.length >= limit) break;
    }
    return json({ items });
  } catch (e) {
    // テーブル未作成などは空で返す
    return json({ items: [], note: (e as Error).message });
  }
};
