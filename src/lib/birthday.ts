import type { MapObject } from "./types";

// 誕生日文字列を解析。「6月26日」「6/26」「6-26」「6.26」「6月」などに対応。
export function parseBirthday(s?: string | null): { month: number; day: number } | null {
  if (!s) return null;
  const t = String(s).trim();
  let m = t.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  if (m) return { month: +m[1], day: +m[2] };
  m = t.match(/^(\d{1,2})\s*[/.\-]\s*(\d{1,2})$/);
  if (m) return { month: +m[1], day: +m[2] };
  m = t.match(/(\d{1,2})\s*月/);
  if (m) return { month: +m[1], day: 0 };
  return null;
}

export function birthdayMonth(s?: string | null): number | null {
  const p = parseBirthday(s);
  return p ? p.month : null;
}

// 今月・来月に誕生日を迎えるメンバーのテロップ文を生成。
export function buildTickerText(objects: MapObject[]): string {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

  const members = (month: number) =>
    objects
      .map((o) => ({ o, b: parseBirthday(o.birthday) }))
      .filter((x) => x.b && x.b.month === month)
      .map((x) => ({
        name: x.o.label || x.o.memberName || "名前なし",
        date: (x.o.birthday as string),
        day: x.b ? x.b.day : 0,
      }))
      .sort((a, b) => a.day - b.day);

  const parts: string[] = [];
  const cur = members(currentMonth);
  const nxt = members(nextMonth);
  if (cur.length) {
    const list = cur.map((m) => m.date + " " + m.name + "さん").join("　");
    parts.push("今月お誕生日を迎えるメンバーは・・・" + list + "です。　　お誕生日おめでとうございます。");
  }
  if (nxt.length) {
    const list = nxt.map((m) => m.date + " " + m.name + "さん").join("　");
    parts.push("来月お誕生日を迎えるメンバーは・・・" + list + "です。");
  }
  return parts.join("　　　　");
}
