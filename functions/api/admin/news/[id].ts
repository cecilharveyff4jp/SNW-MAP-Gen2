// DELETE /api/admin/news/:id — ニュースを非表示にする（＝そのaudit_log由来ニュースを全員から消す。編集者）。
// :id は audit_log.id。news_hidden に登録して除外。
import { requireEditor, json, getEmail, writeAudit, type AdminEnv } from "../_shared";

export const onRequestDelete: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return json({ error: "invalid id" }, 400);
  const actor = await getEmail(context);
  try {
    await context.env.DB.prepare(
      "INSERT INTO news_hidden (audit_id, actor_email) VALUES (?, ?) ON CONFLICT(audit_id) DO NOTHING"
    ).bind(id, actor).run();
    await writeAudit(context.env, actor, "hide", "news", id, null);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};
