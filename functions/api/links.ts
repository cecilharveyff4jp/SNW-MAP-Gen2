// GET /api/links — リンク集（公開）。
interface Env { DB: D1Database }
interface Row { id: number; label: string; url: string; sort_order: number; description: string | null }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { results } = await context.env.DB.prepare(
      "SELECT id, label, url, sort_order, description FROM links ORDER BY sort_order, id"
    ).all<Row>();
    const links = (results ?? []).map((r) => ({ id: r.id, label: r.label, url: r.url, sortOrder: r.sort_order, description: r.description ?? "" }));
    return new Response(JSON.stringify(links), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=10, stale-while-revalidate=60" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } });
  }
};
