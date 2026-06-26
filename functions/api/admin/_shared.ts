// 書き込み系 Function の共通処理：認可ガード・バリデーション・JSON 応答
export interface AdminEnv {
  DB: D1Database;
  // カンマ区切りの許可メール。未設定なら（開発中とみなし）ガードを通す。
  // 本番では Cloudflare Access を前段に置き、ここに許可メールを設定する。
  ALLOWED_EMAILS?: string;
}

const TYPES = [
  "HQ",
  "CITY",
  "STATUE",
  "DEPOT",
  "BEAR_TRAP",
  "MOUNTAIN",
  "LAKE",
  "FLAG",
];

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** Cloudflare Access のヘッダと許可メールで簡易ガード。OK なら null を返す。 */
export function guard(context: {
  request: Request;
  env: AdminEnv;
}): Response | null {
  const allowed = (context.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return null; // 未設定：開発中は許可
  const email = context.request.headers.get(
    "Cf-Access-Authenticated-User-Email"
  );
  if (email && allowed.includes(email)) return null;
  return json({ error: "unauthorized" }, 403);
}

export interface ValidObject {
  mapId: number;
  type: string;
  anchorX: number;
  anchorY: number;
  w: number;
  h: number;
  label: string | null;
}

function intOf(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isInteger(n) ? n : null;
}

/** リクエストボディを検証して正規化。NG なら {error} を返す。 */
export function validateBody(body: unknown): ValidObject | { error: string } {
  if (typeof body !== "object" || body === null)
    return { error: "body must be object" };
  const b = body as Record<string, unknown>;

  const type = String(b.type ?? "");
  if (!TYPES.includes(type)) return { error: "invalid type" };

  const anchorX = intOf(b.anchorX);
  const anchorY = intOf(b.anchorY);
  if (anchorX === null || anchorY === null)
    return { error: "anchorX/anchorY must be integers" };

  const w = intOf(b.w);
  const h = intOf(b.h);
  if (w === null || h === null || w < 1 || h < 1)
    return { error: "w/h must be integers >= 1" };

  const mapId = b.mapId == null ? 1 : intOf(b.mapId);
  if (mapId === null) return { error: "invalid mapId" };

  const label =
    b.label == null || b.label === "" ? null : String(b.label).slice(0, 100);

  return { mapId, type, anchorX, anchorY, w, h, label };
}
