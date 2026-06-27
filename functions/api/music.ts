// GET /api/music — 曲一覧（公開）。
interface Env { DB: D1Database }
interface Row { id: number; title: string; url: string; type: string; sort_order: number; composer: string | null; producer: string | null }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { results } = await context.env.DB.prepare(
      "SELECT id, title, url, type, sort_order, composer, producer FROM music ORDER BY sort_order, id"
    ).all<Row>();
    const music = (results ?? []).map((r) => ({ id: r.id, title: r.title, url: r.url, type: r.type, sortOrder: r.sort_order, composer: r.composer ?? "", producer: r.producer ?? "" }));
    return new Response(JSON.stringify(music), { headers: { "content-type": "application/json; charset=utf-8" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } });
  }
};
