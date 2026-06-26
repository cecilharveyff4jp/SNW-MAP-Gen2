// POST /api/admin/links — リンク追加（承認済み編集者）。
import { requireEditor, json, type AdminEnv } from "./_shared";

function clean(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

export const onRequestPost: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;

  let body: { label?: string; url?: string } = {};
  try { body = (await context.request.json()) as typeof body; } catch { return json({ error: "invalid JSON" }, 400); }
  const label = clean(body.label, 60);
  const url = clean(body.url, 500);
  if (!label || !url) return json({ error: "label/url required" }, 400);
  if (!/^https?:\/\//i.test(url)) return json({ error: "url must start with http(s)://" }, 400);

  const ord = await context.env.DB.prepare("SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM links").first<{ n: number }>();
  const res = await context.env.DB.prepare(
    "INSERT INTO links (label, url, sort_order) VALUES (?, ?, ?)"
  ).bind(label, url, ord?.n ?? 1).run();
  return json({ id: res.meta.last_row_id }, 201);
};
