// POST /api/admin/music — 曲を追加（承認済み編集者）。
import { requireEditor, json, type AdminEnv } from "./_shared";

export const onRequestPost: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;

  let body: { title?: string; url?: string; type?: string; composer?: string; producer?: string } = {};
  try { body = (await context.request.json()) as typeof body; } catch { return json({ error: "invalid JSON" }, 400); }
  const title = String(body.title ?? "").trim().slice(0, 80);
  const url = String(body.url ?? "").trim().slice(0, 500);
  const type = body.type === "city" ? "city" : "alliance";
  const composer = String(body.composer ?? "").trim().slice(0, 120) || null;
  const producer = String(body.producer ?? "").trim().slice(0, 120) || null;
  if (!title || !url) return json({ error: "title/url required" }, 400);
  if (!/^https?:\/\//i.test(url)) return json({ error: "url must start with http(s)://" }, 400);

  const ord = await context.env.DB.prepare("SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM music WHERE type = ?").bind(type).first<{ n: number }>();
  const res = await context.env.DB.prepare(
    "INSERT INTO music (title, url, type, sort_order, composer, producer) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(title, url, type, ord?.n ?? 1, composer, producer).run();
  return json({ id: res.meta.last_row_id }, 201);
};
