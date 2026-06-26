// 認証・認可の共通処理。
// 認証は自前の Google OAuth（/api/auth/*）。ログイン後、署名付きセッション Cookie
// (session) に検証済みメールを保持する。getEmail はこの Cookie を検証して返す。
// 認可（オーナー / 承認済み編集者）は OWNER_EMAIL と D1 users で判定。
// OWNER_EMAIL 未設定時は「開発中」とみなしガードを通す（本番では必ず設定）。

export interface AdminEnv {
  DB: D1Database;
  OWNER_EMAIL?: string;
  SESSION_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
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

// ---- base64url / セッション署名（Web Crypto HMAC-SHA256） ----
function bytesToB64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function strToB64url(str: string): string {
  return bytesToB64url(new TextEncoder().encode(str));
}
function b64urlToStr(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return bytesToB64url(new Uint8Array(sig));
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export interface SessionPayload {
  email: string;
  name?: string;
  exp: number;
}

export async function signSession(
  payload: SessionPayload,
  secret: string
): Promise<string> {
  const data = strToB64url(JSON.stringify(payload));
  const sig = await hmac(data, secret);
  return data + "." + sig;
}

export async function verifySession(
  token: string,
  secret: string
): Promise<SessionPayload | null> {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(data, secret);
  if (!safeEqual(sig, expected)) return null;
  try {
    const p = JSON.parse(b64urlToStr(data)) as SessionPayload;
    if (!p.email || (p.exp && Date.now() > p.exp)) return null;
    return p;
  } catch {
    return null;
  }
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// ---- 認証主体 ----
type Ctx = { request: Request; env: AdminEnv };

/** セッション Cookie から検証済みメール（小文字）。無ければ null。 */
export async function getEmail(context: Ctx): Promise<string | null> {
  const secret = context.env.SESSION_SECRET;
  if (!secret) return null;
  const cookie = parseCookies(context.request.headers.get("Cookie"))["session"];
  if (!cookie) return null;
  const p = await verifySession(cookie, secret);
  return p?.email ? p.email.toLowerCase() : null;
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

export async function getStatus(context: Ctx): Promise<MeStatus> {
  const email = await getEmail(context);
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

/** オーナー専用。OK なら null。 */
export async function requireOwner(context: Ctx): Promise<Response | null> {
  if (!ownerEmail(context.env)) return null; // 開発中は許可
  const email = await getEmail(context);
  return isOwner(email, context.env)
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

// ---- オブジェクト検証 ----
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
