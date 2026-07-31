// POST /api/admin/survey — アンケートの募集トグル（編集権限）。
import { requireEditor, json, getEmail, writeAudit, type AdminEnv } from "./_shared";

export const onRequestPost: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;
  let body: { key?: string; active?: boolean } = {};
  try { body = (await context.request.json()) as { key?: string; active?: boolean }; } catch { /* noop */ }
  const key = (body.key || "").toString();
  if (!key) return json({ error: "missing key" }, 400);
  const active = body.active ? 1 : 0;
  try {
    const r = await context.env.DB.prepare("UPDATE surveys SET active = ? WHERE skey = ?").bind(active, key).run();
    await writeAudit(context.env, await getEmail(context), active ? "survey_open" : "survey_close", "survey", null, key);
    return json({ ok: true, changed: r.meta.changes });
  } catch (e) { return json({ error: (e as Error).message }, 500); }
};
