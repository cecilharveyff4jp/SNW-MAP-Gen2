// POST /api/suggestions — 変更提案を作成（ログインユーザー）。Discord Webhookへ通知。
import { getStatus, json, type AdminEnv } from "./admin/_shared";

const FIELDS = ["birthday", "fc_level", "note", "position", "name", "other"];
const FIELD_LABEL: Record<string, string> = { birthday: "誕生日", fc_level: "溶鉱炉レベル", note: "メモ", position: "位置入替", name: "名前", other: "その他" };

export const onRequestPost: PagesFunction<AdminEnv> = async (context) => {
  const me = await getStatus(context);
  if (!me.email) return json({ error: "login required" }, 401);

  let body: { objectId?: unknown; mapId?: unknown; objectLabel?: unknown; field?: unknown; value?: unknown; comment?: unknown } = {};
  try { body = (await context.request.json()) as typeof body; } catch { return json({ error: "invalid JSON" }, 400); }

  const field = String(body.field ?? "");
  if (!FIELDS.includes(field)) return json({ error: "invalid field" }, 400);
  const objectId = Number.isInteger(body.objectId) ? (body.objectId as number) : null;
  const mapId = Number.isInteger(body.mapId) ? (body.mapId as number) : null;
  const objectLabel = (typeof body.objectLabel === "string" ? body.objectLabel.trim().slice(0, 100) : "") || null;
  const value = (typeof body.value === "string" ? body.value.trim().slice(0, 300) : "") || null;
  const comment = (typeof body.comment === "string" ? body.comment.trim().slice(0, 500) : "") || null;
  if (!value && !comment) return json({ error: "value or comment required" }, 400);

  await context.env.DB.prepare(
    "INSERT INTO suggestions (object_id, map_id, object_label, field, value, comment, proposer_email, proposer_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(objectId, mapId, objectLabel, field, value, comment, me.email, me.displayName).run();

  const hook = context.env.DISCORD_WEBHOOK_URL;
  if (hook) {
    const lines = [
      "📝 **変更提案が届きました**",
      "対象: " + (objectLabel || (objectId ? "ID " + objectId : "（全体）")),
      "項目: " + (FIELD_LABEL[field] ?? field),
      value ? "内容: " + value : null,
      comment ? "コメント: " + comment : null,
      "提案者: " + (me.displayName || me.email),
    ].filter(Boolean);
    try { await fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: lines.join("\n") }) }); } catch { /* noop */ }
  }

  return json({ ok: true }, 201);
};
