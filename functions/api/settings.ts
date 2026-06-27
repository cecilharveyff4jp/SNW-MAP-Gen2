// Cloudflare Pages Function: GET /api/settings （同盟情報・公開読み取り）
// meta テーブルのキー value を JSON で返す。

interface Env {
  DB: D1Database;
}

const KEYS = { server: "alliance_server", name: "alliance_name", note: "alliance_note", abbr: "alliance_abbr" };

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { results } = await context.env.DB.prepare(
      "SELECT key, value FROM meta WHERE key IN (?, ?, ?, ?)"
    ).bind(KEYS.server, KEYS.name, KEYS.note, KEYS.abbr).all<{ key: string; value: string }>();
    const m: Record<string, string> = {};
    for (const r of results ?? []) m[r.key] = r.value;
    return new Response(JSON.stringify({
      serverNo: m[KEYS.server] ?? "",
      allianceName: m[KEYS.name] ?? "",
      note: m[KEYS.note] ?? "",
      abbr: m[KEYS.abbr] ?? "",
    }), { headers: { "content-type": "application/json; charset=utf-8" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};
