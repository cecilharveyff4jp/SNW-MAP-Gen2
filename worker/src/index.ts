// 誕生日デイリー通知（毎日0時JST）。今日が誕生日のメンバーを Discord Webhook へ投稿。
interface Env { DB: D1Database; DISCORD_WEBHOOK_URL?: string }
interface Row { label: string | null; member_name: string | null; birthday: string | null }

// 「M月D日」「M/D」「M-D」「M.D」から月日を取り出す。
function parseMD(s: string): { m: number; d: number } | null {
  if (!s) return null;
  let mm = s.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (mm) return { m: Number(mm[1]), d: Number(mm[2]) };
  mm = s.match(/(\d{1,2})\s*[/.\-]\s*(\d{1,2})/);
  if (mm) return { m: Number(mm[1]), d: Number(mm[2]) };
  return null;
}

export default {
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    const jst = new Date(Date.now() + 9 * 3600 * 1000);
    const M = jst.getUTCMonth() + 1, D = jst.getUTCDate();
    const { results } = await env.DB.prepare(
      "SELECT label, member_name, birthday FROM objects WHERE birthday IS NOT NULL AND birthday != ''"
    ).all<Row>();
    const today = (results ?? [])
      .filter((r) => { const md = parseMD(r.birthday || ""); return md && md.m === M && md.d === D; })
      .map((r) => (r.label || r.member_name || "（名称なし）").trim());
    if (!today.length) return;
    const hook = env.DISCORD_WEBHOOK_URL;
    if (!hook) return;
    const content = "🎂 **今日（" + M + "月" + D + "日）が誕生日のメンバー**\n" + today.map((n) => "・" + n).join("\n");
    await fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content }) });
  },
};
