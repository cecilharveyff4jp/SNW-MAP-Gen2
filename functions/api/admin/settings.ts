// Cloudflare Pages Function: PUT /api/admin/settings （同盟情報の更新・オーナーのみ）
import { requireOwner, json, type AdminEnv } from "./_shared";

const KEYS = { server: "alliance_server", name: "alliance_name", note: "alliance_note", abbr: "alliance_abbr" };

// 全角→半角（カナ・英数字）。スペース節約と取得高速化のため保存時に半角化する。
const KANA: Record<string, string> = {
  "ガ": "ｶﾞ", "ギ": "ｷﾞ", "グ": "ｸﾞ", "ゲ": "ｹﾞ", "ゴ": "ｺﾞ", "ザ": "ｻﾞ", "ジ": "ｼﾞ", "ズ": "ｽﾞ", "ゼ": "ｾﾞ", "ゾ": "ｿﾞ",
  "ダ": "ﾀﾞ", "ヂ": "ﾁﾞ", "ヅ": "ﾂﾞ", "デ": "ﾃﾞ", "ド": "ﾄﾞ", "バ": "ﾊﾞ", "ビ": "ﾋﾞ", "ブ": "ﾌﾞ", "ベ": "ﾍﾞ", "ボ": "ﾎﾞ",
  "パ": "ﾊﾟ", "ピ": "ﾋﾟ", "プ": "ﾌﾟ", "ペ": "ﾍﾟ", "ポ": "ﾎﾟ", "ヴ": "ｳﾞ",
  "ァ": "ｧ", "ィ": "ｨ", "ゥ": "ｩ", "ェ": "ｪ", "ォ": "ｫ", "ャ": "ｬ", "ュ": "ｭ", "ョ": "ｮ", "ッ": "ｯ", "ー": "ｰ",
  "ア": "ｱ", "イ": "ｲ", "ウ": "ｳ", "エ": "ｴ", "オ": "ｵ", "カ": "ｶ", "キ": "ｷ", "ク": "ｸ", "ケ": "ｹ", "コ": "ｺ",
  "サ": "ｻ", "シ": "ｼ", "ス": "ｽ", "セ": "ｾ", "ソ": "ｿ", "タ": "ﾀ", "チ": "ﾁ", "ツ": "ﾂ", "テ": "ﾃ", "ト": "ﾄ",
  "ナ": "ﾅ", "ニ": "ﾆ", "ヌ": "ﾇ", "ネ": "ﾈ", "ノ": "ﾉ", "ハ": "ﾊ", "ヒ": "ﾋ", "フ": "ﾌ", "ヘ": "ﾍ", "ホ": "ﾎ",
  "マ": "ﾏ", "ミ": "ﾐ", "ム": "ﾑ", "メ": "ﾒ", "モ": "ﾓ", "ヤ": "ﾔ", "ユ": "ﾕ", "ヨ": "ﾖ",
  "ラ": "ﾗ", "リ": "ﾘ", "ル": "ﾙ", "レ": "ﾚ", "ロ": "ﾛ", "ワ": "ﾜ", "ヲ": "ｦ", "ン": "ﾝ",
  "、": "､", "。": "｡", "「": "｢", "」": "｣", "・": "･", "　": " ",
};
function toHalf(s: string): string {
  s = s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  return Array.from(s).map((c) => KANA[c] ?? c).join("");
}

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
