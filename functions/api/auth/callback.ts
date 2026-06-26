// GET /api/auth/callback — Google からの戻り。code をトークンに交換し、
// id_token から検証済みメールを取り出して署名セッション Cookie を発行する。
import { signSession, parseCookies, type AdminEnv } from "../admin/_shared";

interface IdTokenPayload {
  email?: string;
  email_verified?: boolean;
  name?: string;
}

function decodeJwtPayload(idToken: string): IdTokenPayload {
  const parts = idToken.split(".");
  if (parts.length < 2) return {};
  let s = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  try {
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes)) as IdTokenPayload;
  } catch {
    return {};
  }
}

export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  const env = context.env;
  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = parseCookies(context.request.headers.get("Cookie"))[
    "oauth_state"
  ];

  if (!code || !state || !cookieState || state !== cookieState) {
    return new Response("invalid state", { status: 400 });
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET) {
    return new Response("Google ログイン未設定", { status: 500 });
  }

  const redirectUri = url.origin + "/api/auth/callback";
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    return new Response("token exchange failed", { status: 502 });
  }
  const tok = (await tokenRes.json()) as { id_token?: string };
  if (!tok.id_token) return new Response("no id_token", { status: 502 });

  const payload = decodeJwtPayload(tok.id_token);
  const email = (payload.email || "").toLowerCase();
  if (!email || payload.email_verified === false) {
    return new Response("メールが確認できませんでした", { status: 403 });
  }

  const session = await signSession(
    { email, name: payload.name || "", exp: Date.now() + 30 * 24 * 3600 * 1000 },
    env.SESSION_SECRET
  );

  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `session=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 3600}`
  );
  headers.append(
    "Set-Cookie",
    "oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
  );
  headers.set("Location", "/account");
  return new Response(null, { status: 302, headers });
};
