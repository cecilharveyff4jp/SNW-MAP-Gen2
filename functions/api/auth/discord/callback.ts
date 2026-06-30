// GET /api/auth/discord/callback — Discord からの戻り。code をトークンに交換し、
// /users/@me から検証済みメールを取り出して署名セッション Cookie を発行する。
import { signSession, parseCookies, type AdminEnv } from "../../admin/_shared";

interface DiscordUser {
  email?: string | null;
  verified?: boolean;
  username?: string;
  global_name?: string | null;
}

export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  const env = context.env;
  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = parseCookies(context.request.headers.get("Cookie"))["doauth_state"];

  // ユーザーがキャンセル/拒否した（error付き、または code 無し）→ ログイン画面へ静かに戻す。
  if (url.searchParams.get("error") || !code) {
    const h = new Headers();
    h.append("Set-Cookie", "doauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
    h.set("Location", "/account");
    return new Response(null, { status: 302, headers: h });
  }
  if (!state || !cookieState || state !== cookieState) {
    return new Response("invalid state", { status: 400 });
  }
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) {
    return new Response("Discord ログイン未設定", { status: 500 });
  }

  const redirectUri = url.origin + "/api/auth/discord/callback";
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    return new Response("token exchange failed", { status: 502 });
  }
  const tok = (await tokenRes.json()) as { access_token?: string };
  if (!tok.access_token) return new Response("no access_token", { status: 502 });

  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: "Bearer " + tok.access_token },
  });
  if (!userRes.ok) return new Response("user fetch failed", { status: 502 });
  const u = (await userRes.json()) as DiscordUser;

  const email = (u.email || "").toLowerCase();
  if (!email || u.verified === false) {
    return new Response("メールが確認できませんでした（Discordのメール未認証、またはメール権限が許可されていません）", { status: 403 });
  }
  const name = u.global_name || u.username || "";

  const session = await signSession(
    { email, name, exp: Date.now() + 30 * 24 * 3600 * 1000 },
    env.SESSION_SECRET
  );

  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `session=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 3600}`
  );
  headers.append(
    "Set-Cookie",
    "doauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
  );
  headers.set("Location", "/account");
  return new Response(null, { status: 302, headers });
};
