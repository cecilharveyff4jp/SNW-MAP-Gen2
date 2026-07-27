// POST /api/admin/power-bulk — 総力の一括更新を1件のニュースとして記録（編集者）。
// 集計の総力ランキングで複数都市を更新して「完了」した時にフロントから呼ぶ。
import { requireEditor, json, getEmail, writeAudit, type AdminEnv } from "./_shared";

export const onRequestPost: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireEditor(context);
  if (denied) return denied;
  let body: { count?: unknown } = {};
  try { body = (await context.request.json()) as { count?: unknown }; } catch { /* noop */ }
  const count = Math.max(0, Math.min(9999, Math.round(Number(body.count) || 0)));
  await writeAudit(context.env, await getEmail(context), "bulk", "power", null, "総力一括更新", { 都市数: count });
  return json({ ok: true });
};
