// Cloudflare Pages Function: GET /api/health
// D1 への疎通を確認して JSON を返すサンプル。

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  let db = "unknown";
  try {
    // schema 適用後は meta テーブルが存在する。簡単な疎通確認。
    const row = await context.env.DB.prepare(
      "SELECT value FROM meta WHERE key = ?"
    )
      .bind("schema_version")
      .first<{ value: string }>();
    db = row ? `ok (schema ${row.value})` : "ok (no meta row)";
  } catch (e) {
    db = `error: ${(e as Error).message}`;
  }

  return new Response(
    JSON.stringify({ ok: true, db, time: new Date().toISOString() }),
    { headers: { "content-type": "application/json; charset=utf-8" } }
  );
};
