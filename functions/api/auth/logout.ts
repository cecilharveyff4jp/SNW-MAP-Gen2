// GET /api/auth/logout — セッション Cookie を消して地図へ戻す。
import type { AdminEnv } from "../admin/_shared";

export const onRequestGet: PagesFunction<AdminEnv> = async () => {
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    "session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
  );
  headers.set("Location", "/");
  return new Response(null, { status: 302, headers });
};
