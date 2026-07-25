// GET /api/power-history — 総力履歴（公開読み取り）。?object=ID で特定都市のみ、無指定で全件。
interface Env { DB: D1Database }
interface Row { id: number; object_id: number; power: number; recorded_at: string; source: string }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const obj = new URL(context.request.url).searchParams.get("object");
    const stmt = obj != null && /^\d+$/.test(obj)
      ? context.env.DB.prepare("SELECT id, object_id, power, recorded_at, source FROM power_history WHERE object_id = ? ORDER BY recorded_at, id").bind(Number(obj))
      : context.env.DB.prepare("SELECT id, object_id, power, recorded_at, source FROM power_history ORDER BY recorded_at, id");
    const { results } = await stmt.all<Row>();
    const rows = (results ?? []).map((r) => ({ id: r.id, objectId: r.object_id, power: r.power, recordedAt: r.recorded_at, source: r.source }));
    return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json; charset=utf-8" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } });
  }
};
