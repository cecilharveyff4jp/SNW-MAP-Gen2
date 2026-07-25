// Cloudflare Pages Function: PUT/DELETE /api/admin/objects/:id
import { requireEditor, validateBody, json, getEmail, writeAudit, diffObject, type AdminEnv, type PrevObject } from "../_shared";

export const onRequestPut: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
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
    // 履歴・監査ログ用に更新前の行を取得
    const prev = await context.env.DB.prepare("SELECT type, anchor_x, anchor_y, w, h, label, member_name, game_id, fc_level, power, placed, note, birthday, music_ids FROM objects WHERE id = ?").bind(id).first<PrevObject>();
    const res = await context.env.DB.prepare(
      "UPDATE objects SET type = ?, anchor_x = ?, anchor_y = ?, w = ?, h = ?, label = ?, member_name = ?, game_id = ?, fc_level = ?, power = ?, placed = ?, note = ?, birthday = ?, music_ids = ? WHERE id = ?"
    )
      .bind(
        v.type,
        v.anchorX,
        v.anchorY,
        v.w,
        v.h,
        v.label,
        v.memberName,
        v.gameId,
        v.fcLevel,
        v.power,
        v.placed,
        v.note,
        v.birthday,
        v.musicIds,
        id
      )
      .run();
    if (res.meta.changes === 0) return json({ error: "not found" }, 404);
    // 総力が「新しい数値」に変わったときだけ履歴を1行追記（空欄化・変化なしは記録しない）
    if (v.power != null && v.power !== (prev?.power ?? null)) {
      const src = (body as { source?: string })?.source === "scrcpy" ? "scrcpy" : "manual";
      try { await context.env.DB.prepare("INSERT INTO power_history (object_id, power, source) VALUES (?, ?, ?)").bind(id, v.power, src).run(); } catch { /* 履歴失敗は本更新を妨げない */ }
    }
    // 監査ログ: 変更差分を記録（無変更は残さない）
    if (prev) {
      const d = diffObject(prev, v);
      if (d.action) await writeAudit(context.env, await getEmail(context), d.action, "object", id, v.label ?? v.memberName ?? v.type, d.detail);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};

export const onRequestDelete: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;

  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return json({ error: "invalid id" }, 400);

  try {
    const prev = await context.env.DB.prepare("SELECT type, label, member_name FROM objects WHERE id = ?").bind(id).first<{ type: string; label: string | null; member_name: string | null }>();
    const res = await context.env.DB.prepare(
      "DELETE FROM objects WHERE id = ?"
    )
      .bind(id)
      .run();
    if (res.meta.changes === 0) return json({ error: "not found" }, 404);
    await writeAudit(context.env, await getEmail(context), "delete", "object", id, prev?.label ?? prev?.member_name ?? prev?.type ?? null);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};
