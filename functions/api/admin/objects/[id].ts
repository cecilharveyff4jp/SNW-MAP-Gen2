// Cloudflare Pages Function: PUT/DELETE /api/admin/objects/:id
import { guard, validateBody, json, type AdminEnv } from "../_shared";

export const onRequestPut: PagesFunction<AdminEnv> = async (context) => {
  const denied = guard(context);
  if (denied) return denied;

  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return json({ error: "invalid id" }, 400);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const v = validateBody(body);
  if ("error" in v) return json({ error: v.error }, 400);

  try {
    const res = await context.env.DB.prepare(
      "UPDATE objects SET type = ?, anchor_x = ?, anchor_y = ?, w = ?, h = ?, label = ? WHERE id = ?"
    )
      .bind(v.type, v.anchorX, v.anchorY, v.w, v.h, v.label, id)
      .run();
    if (res.meta.changes === 0) return json({ error: "not found" }, 404);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};

export const onRequestDelete: PagesFunction<AdminEnv> = async (context) => {
  const denied = guard(context);
  if (denied) return denied;

  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return json({ error: "invalid id" }, 400);

  try {
    const res = await context.env.DB.prepare(
      "DELETE FROM objects WHERE id = ?"
    )
      .bind(id)
      .run();
    if (res.meta.changes === 0) return json({ error: "not found" }, 404);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};
