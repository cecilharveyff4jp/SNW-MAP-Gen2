// Cloudflare Pages Function: POST /api/admin/objects （オブジェクト新規作成）
// 書き込み系は /api/admin/* に集約。本番では Cloudflare Access で保護する。
import { requireEditor, validateBody, json, type AdminEnv } from "./_shared";

export const onRequestPost: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;

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
      "INSERT INTO objects (map_id, type, anchor_x, anchor_y, w, h, label, member_name, game_id, fc_level, note, birthday) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(
        v.mapId,
        v.type,
        v.anchorX,
        v.anchorY,
        v.w,
        v.h,
        v.label,
        v.memberName,
        v.gameId,
        v.fcLevel,
        v.note,
        v.birthday
      )
      .run();
    return json({ id: res.meta.last_row_id }, 201);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};
