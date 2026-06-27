// PUT/DELETE /api/admin/music/:id — 曲の更新/削除（承認済み編集者）。
import { requireEditor, json, type AdminEnv } from "../_shared";

export const onRequestPut: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return json({ error: "invalid id" }, 400);

  let body: { title?: string; url?: string; type?: string; sortOrder?: number; composer?: string; producer?: string } = {};
  try { body = (await context.request.json()) as typeof body; } catch { return json({ error: "invalid JSON" }, 400); }

  const sets: string[] = [];
  const vals: unknown[] = [];
  if (typeof body.title === "string") { sets.push("title = ?"); vals.push(body.title.trim().slice(0, 80) || "曲"); }
  if (typeof body.url === "string") {
    const url = body.url.trim().slice(0, 500);
    if (!/^https?:\/\//i.test(url)) return json({ error: "url must start with http(s)://" }, 400);
    sets.push("url = ?"); vals.push(url);
  }
  if (body.type === "alliance" || body.type === "city") { sets.push("type = ?"); vals.push(body.type); }
  if (typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder)) { sets.push("sort_order = ?"); vals.push(body.sortOrder); }
  if (typeof body.composer === "string") { sets.push("composer = ?"); vals.push(body.composer.trim().slice(0, 120) || null); }
  if (typeof body.producer === "string") { sets.push("producer = ?"); vals.push(body.producer.trim().slice(0, 120) || null); }
  if (sets.length === 0) return json({ error: "no fields" }, 400);

  vals.push(id);
  const res = await context.env.DB.prepare("UPDATE music SET " + sets.join(", ") + " WHERE id = ?").bind(...vals).run();
  if (res.meta.changes === 0) return json({ error: "not found" }, 404);
  return json({ ok: true });
};

export const onRequestDelete: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return json({ error: "invalid id" }, 400);
  const res = await context.env.DB.prepare("DELETE FROM music WHERE id = ?").bind(id).run();
  if (res.meta.changes === 0) return json({ error: "not found" }, 404);
  return json({ ok: true });
};
