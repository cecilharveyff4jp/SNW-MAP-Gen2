import type { MapObject } from "./types";

// 今月・来月に誕生日を迎えるメンバーのテロップ文を生成（旧版踏襲）。
// birthday は「3月15日」のような表記を想定。名前は memberName を優先。
export function buildTickerText(objects: MapObject[]): string {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

  const members = (month: number) =>
    objects
      .filter((o) => {
        const m = o.birthday?.match(/(\d+)月/);
        return !!m && parseInt(m[1], 10) === month;
      })
      .map((o) => ({
        name: o.memberName || o.label || "名前なし",
        date: o.birthday as string,
        day: parseInt((o.birthday as string).match(/(\d+)日/)?.[1] || "0", 10),
      }))
      .sort((a, b) => a.day - b.day);

  const parts: string[] = [];
  const cur = members(currentMonth);
  const nxt = members(nextMonth);
  if (cur.length) {
    const list = cur.map((m) => m.date + " " + m.name + "さん").join("　");
    parts.push(
      "今月お誕生日を迎えるメンバーは・・・" + list + "です。　　お誕生日おめでとうございます。"
    );
  }
  if (nxt.length) {
    const list = nxt.map((m) => m.date + " " + m.name + "さん").join("　");
    parts.push("来月お誕生日を迎えるメンバーは・・・" + list + "です。");
  }
  return parts.join("　　　　");
}
