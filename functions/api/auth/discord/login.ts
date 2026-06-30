// GET /api/auth/discord/login — Discord のログイン画面へリダイレクト。
import type { AdminEnv } from "../../admin/_shared";

export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  const env = context.env;
  if (!env.DISCORD_CLIENT_ID) {
    return new Response("Discord ログイン未設定 (DISCORD_CLIENT_ID)", { status: 500 });
  }
  const url = new URL(context.request.url);
  const redirectUri = url.origin + "/api/auth/discord/callback";
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify email",
    state,
    prompt: "consent",
  });

  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `doauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
  );
  headers.set(
    "Location",
    "https://discord.com/api/oauth2/authorize?" + params.toString()
  );
  return new Response(null, { status: 302, headers });
};
