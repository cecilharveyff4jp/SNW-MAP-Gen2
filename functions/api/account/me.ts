// GET /api/account/me — Cloudflare Access のログイン主体の状態を返す。
// Access 配下に置く（未ログインなら status=anonymous）。
import { getStatus, json, type AdminEnv } from "../admin/_shared";

export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  const s = await getStatus(context);
  return json(s);
};
