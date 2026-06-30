// GET /api/maps — マップ一覧（公開）。
interface Env { DB: D1Database }
interface Row { id: number; name: string; is_visible: number; is_base: number; sort_order: number }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { results } = await context.env.DB.prepare(
      "SELECT id, name, is_visible, is_base, sort_order FROM maps ORDER BY sort_order, id"
    ).all<Row>();
    const maps = (results ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      isVisible: !!r.is_visible,
      isBase: !!r.is_base,
      sortOrder: r.sort_order,
    }));
    return new Response(JSON.stringify(maps), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=10, stale-while-revalidate=60" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } });
  }
};
