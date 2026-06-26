// 認証・認可の共通処理。
// 認証は Cloudflare Access が前段で行い、検証済みメールをヘッダで渡す。
// 認可（オーナー / 承認済み編集者）は OWNER_EMAIL と D1 users テーブルで判定。
// OWNER_EMAIL 未設定時は「開発中」とみなしガードを通す（本番では必ず設定）。

export interface AdminEnv {
  DB: D1Database;
  OWNER_EMAIL?: string;
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

type Ctx = { request: Request; env: AdminEnv };

/** Cloudflare Access が付与する検証済みメール（小文字）。無ければ null。 */
export function getEmail(context: Ctx): string | null {
  const e = context.request.headers.get("Cf-Access-Authenticated-User-Email");
  return e ? e.trim().toLowerCase() : null;
}

export function ownerEmail(env: AdminEnv): string | null {
  const o = (env.OWNER_EMAIL || "").trim().toLowerCase();
  return o || null;
}

export function isOwner(email: string | null, env: AdminEnv): boolean {
  const o = ownerEmail(env);
  return !!o && !!email && email === o;
}

export interface MeStatus {
  email: string | null;
  isOwner: boolean;
  status: string; // anonymous | none | pending | approved | rejected
  displayName: string | null;
}

/** 現在のリクエスト主体の状態を返す。 */
export async function getStatus(context: Ctx): Promise<MeStatus> {
  const email = getEmail(context);
  if (isOwner(email, context.env))
    return { email, isOwner: true, status: "approved", displayName: "オーナー" };
  if (!email)
    return { email: null, isOwner: false, status: "anonymous", displayName: null };
  const row = await context.env.DB.prepare(
    "SELECT status, display_name FROM users WHERE email = ?"
  )
    .bind(email)
    .first<{ status: string; display_name: string | null }>();
  return {
    email,
    isOwner: false,
    status: row?.status ?? "none",
    displayName: row?.display_name ?? null,
  };
}

/** オーナー専用。OK なら null、NG なら 403。 */
export function requireOwner(context: Ctx): Response | null {
  if (!ownerEmail(context.env)) return null; // 開発中は許可
  return isOwner(getEmail(context), context.env)
    ? null
    : json({ error: "forbidden (owner only)" }, 403);
}

/** 承認済み編集者（またはオーナー）専用。OK なら null。 */
export async function requireEditor(context: Ctx): Promise<Response | null> {
  if (!ownerEmail(context.env)) return null; // 開発中は許可
  const s = await getStatus(context);
  if (s.isOwner || s.status === "approved") return null;
  return json({ error: "forbidden (approval required)" }, 403);
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
