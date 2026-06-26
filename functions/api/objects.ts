// Cloudflare Pages Function: GET /api/objects?map=<id>
// D1 の objects を MapObject 形式（camelCase）で返す。

interface Env {
  DB: D1Database;
}

interface Row {
  id: number;
  map_id: number;
  type: string;
  anchor_x: number;
  anchor_y: number;
  w: number;
  h: number;
  label: string | null;
  member_name: string | null;
  game_id: string | null;
  fc_level: number | null;
  note: string | null;
  birthday: string | null;
}

const COLUMNS =
  "id, map_id, type, anchor_x, anchor_y, w, h, label, member_name, game_id, fc_level, note, birthday";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const mapId = url.searchParams.get("map");

  try {
    const stmt = mapId
      ? context.env.DB.prepare(
          "SELECT " + COLUMNS + " FROM objects WHERE map_id = ? ORDER BY id"
        ).bind(Number(mapId))
      : context.env.DB.prepare(
          "SELECT " + COLUMNS + " FROM objects ORDER BY id"
        );

    const { results } = await stmt.all<Row>();
    const objects = (results ?? []).map((r) => ({
      id: r.id,
      mapId: r.map_id,
      type: r.type,
      anchorX: r.anchor_x,
      anchorY: r.anchor_y,
      w: r.w,
      h: r.h,
      label: r.label ?? undefined,
      memberName: r.member_name ?? undefined,
      gameId: r.game_id ?? undefined,
      fcLevel: r.fc_level ?? undefined,
      note: r.note ?? undefined,
      birthday: r.birthday ?? undefined,
    }));

    return new Response(JSON.stringify(objects), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};
