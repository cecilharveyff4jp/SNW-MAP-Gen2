// GET /api/auth/login — Google のログイン画面へリダイレクト。
import type { AdminEnv } from "../admin/_shared";

export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  const env = context.env;
  if (!env.GOOGLE_CLIENT_ID) {
    return new Response("Google ログイン未設定 (GOOGLE_CLIENT_ID)", { status: 500 });
  }
  const url = new URL(context.request.url);
  const redirectUri = url.origin + "/api/auth/callback";
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
  );
  headers.set(
    "Location",
    "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString()
  );
  return new Response(null, { status: 302, headers });
};
