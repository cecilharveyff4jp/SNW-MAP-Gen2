// 公開: GET /api/survey?key=... で回答取得＋集計 / POST で回答をupsert（認証なし＝誰でも編集可）。
interface Env { DB: D1Database }
interface SurveyRow { id: number; skey: string; title: string; active: number; options_json: string | null; map_id: number | null }

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
async function findSurvey(env: Env, key: string): Promise<SurveyRow | null> {
  return env.DB.prepare("SELECT id, skey, title, active, options_json, map_id FROM surveys WHERE skey = ?").bind(key).first<SurveyRow>();
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const key = new URL(context.request.url).searchParams.get("key") || "";
  try {
    const s = await findSurvey(context.env, key);
    if (!s) return json({ error: "not found" }, 404);
    const ans = await context.env.DB.prepare("SELECT member_key, value FROM survey_answers WHERE survey_id = ?").bind(s.id).all<{ member_key: string; value: string }>();
    const rows = ans.results ?? [];
    const answers: Record<string, string> = {};
    const counts: Record<string, number> = {};
    for (const r of rows) { answers[r.member_key] = r.value; counts[r.value] = (counts[r.value] || 0) + 1; }
    let options: unknown = [];
    try { options = s.options_json ? JSON.parse(s.options_json) : []; } catch { options = []; }
    return json({ key: s.skey, title: s.title, active: !!s.active, options, answers, counts, total: rows.length });
  } catch (e) { return json({ error: (e as Error).message }, 500); }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: { key?: string; memberKey?: string; value?: string } = {};
  try { body = await context.request.json(); } catch { return json({ error: "invalid JSON" }, 400); }
  const key = (body.key || "").toString();
  const memberKey = (body.memberKey || "").toString().trim().slice(0, 200);
  const value = (body.value || "").toString().trim().slice(0, 40);
  if (!key || !memberKey || !value) return json({ error: "missing fields" }, 400);
  try {
    const s = await findSurvey(context.env, key);
    if (!s) return json({ error: "not found" }, 404);
    if (!s.active) return json({ error: "closed" }, 409);
    let ok = true;
    try { const opts = (s.options_json ? JSON.parse(s.options_json) : []) as { value: string }[]; if (Array.isArray(opts) && opts.length) ok = opts.some((o) => o.value === value); } catch { ok = true; }
    if (!ok) return json({ error: "invalid value" }, 400);
    await context.env.DB.prepare(
      "INSERT INTO survey_answers (survey_id, member_key, value) VALUES (?, ?, ?) " +
      "ON CONFLICT(survey_id, member_key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
    ).bind(s.id, memberKey, value).run();
    return json({ ok: true });
  } catch (e) { return json({ error: (e as Error).message }, 500); }
};
