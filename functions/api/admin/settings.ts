// Cloudflare Pages Function: PUT /api/admin/settings （同盟情報の更新・オーナーのみ）
import { requireOwner, json, toHalf, type AdminEnv } from "./_shared";

const KEYS = { server: "alliance_server", name: "alliance_name", note: "alliance_note", abbr: "alliance_abbr" };

export const onRequestPut: PagesFunction<AdminEnv> = async (context) => {
  const denied = await requireOwner(context);
  if (denied) return denied;

  let body: { serverNo?: unknown; allianceName?: unknown; note?: unknown; abbr?: unknown };
  try {
    body = (await context.request.json()) as { serverNo?: unknown; allianceName?: unknown; note?: unknown; abbr?: unknown };
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  const upsert = (key: string, value: string) =>
    context.env.DB.prepare(
      "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).bind(key, value).run();

  try {
    if (typeof body.serverNo === "string") await upsert(KEYS.server, toHalf(body.serverNo).trim().slice(0, 32));
    if (typeof body.allianceName === "string") await upsert(KEYS.name, toHalf(body.allianceName).trim().slice(0, 64));
    if (typeof body.abbr === "string") await upsert(KEYS.abbr, toHalf(body.abbr).trim().slice(0, 12));
    if (typeof body.note === "string") await upsert(KEYS.note, body.note.trim().slice(0, 500));
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};
