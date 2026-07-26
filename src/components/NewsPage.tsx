import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { listNews, type NewsItem } from "../lib/api";
import { card, btnGhost } from "../lib/styles";
import { fcDisplay } from "../lib/sizes";
import Icon from "./Icon";

function fmtWhen(ts: string): string {
  const t = Date.parse(ts.replace(" ", "T") + (ts.includes("Z") ? "" : "Z"));
  if (!Number.isFinite(t)) return ts;
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return min + "分前";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + "時間前";
  const d = Math.floor(hr / 24);
  if (d < 7) return d + "日前";
  const dt = new Date(t);
  return (dt.getMonth() + 1) + "/" + dt.getDate();
}

function render(n: NewsItem): { emoji: string; accent: string; text: ReactNode } {
  switch (n.kind) {
    case "new": return { emoji: "🎉", accent: "#2f9e44", text: <><strong>{n.name}</strong> が新しく仲間入り！</> };
    case "fc": return { emoji: "🔥", accent: "#e8590c", text: <><strong>{n.name}</strong> の溶鉱炉レベルが <strong>{fcDisplay(n.level || "")}</strong> に上がりました！</> };
    case "power": return { emoji: "💪", accent: "#1c7ed6", text: <><strong>{n.name}</strong> の総力が <strong>{n.milestoneM}M</strong> を突破！</> };
    case "rename": return { emoji: "✏️", accent: "#6741d9", text: <><strong>{n.from}</strong> が <strong>{n.to}</strong> に改名しました</> };
    case "move": return { emoji: "📍", accent: "#0ca678", text: <><strong>{n.name}</strong> が地図上を移動しました</> };
    default: return { emoji: "•", accent: "#868e96", text: n.name };
  }
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [end, setEnd] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // 既読管理: b=このid以下は既読（一括既読用のしきい値）／ s=しきい値より上で個別に既読にしたid集合。
  // → とびとびに読んでも正しく表現でき、保存量も上限で頭打ち。
  const [readSt, setReadSt] = useState<{ b: number; s: number[] }>(() => {
    try { const v = JSON.parse(localStorage.getItem("snw_news_read") || ""); if (v && typeof v.b === "number" && Array.isArray(v.s)) return { b: v.b, s: v.s }; } catch { /* noop */ }
    // 旧しきい値方式からの移行
    try { const old = Number(localStorage.getItem("snw_news_read_id")) || 0; if (old > 0) return { b: old, s: [] }; } catch { /* noop */ }
    return { b: 0, s: [] };
  });
  const readSet = new Set(readSt.s);
  const isRead = (id: number) => id <= readSt.b || readSet.has(id);
  const unreadCount = items.filter((n) => !isRead(n.id)).length;
  const persistRead = (st: { b: number; s: number[] }) => { try { localStorage.setItem("snw_news_read", JSON.stringify({ b: st.b, s: st.s.filter((i) => i > st.b).sort((a, b) => b - a).slice(0, 1000) })); } catch { /* noop */ } };
  const notifyRead = () => { try { window.dispatchEvent(new CustomEvent("snw-news-read")); } catch { /* noop */ } };
  const markRead = (ids: number[]) => { const set = new Set(readSt.s); ids.forEach((i) => { if (i > readSt.b) set.add(i); }); const next = { b: readSt.b, s: [...set] }; persistRead(next); setReadSt(next); notifyRead(); };
  const markAllRead = () => { const max = items.reduce((m, n) => Math.max(m, n.id), readSt.b); const next = { b: max, s: [] }; persistRead(next); setReadSt(next); notifyRead(); };

  async function load(reset: boolean) {
    if (reset) setLoading(true); else setMore(true);
    try {
      const before = reset ? undefined : items[items.length - 1]?.id;
      const rows = await listNews({ before, limit: 40 });
      setItems((prev) => (reset ? rows : [...prev, ...rows]));
      if (rows.length < 40) setEnd(true);
      setErr(null);
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setLoading(false); setMore(false); }
  }
  useEffect(() => { load(true); /* eslint-disable-next-line */ }, []);

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
        <span style={{ color: "var(--accent, #1c7ed6)", display: "inline-flex" }}><Icon name="star" size={20} /></span>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#1b2330" }}>同盟ニュース</h2>
        {unreadCount > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "var(--accent, #1c7ed6)", padding: "2px 9px", borderRadius: 999 }}>未読 {unreadCount}</span>}
        {unreadCount > 0 && <button onClick={markAllRead} style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: "var(--accent-strong, #4b3fc4)", background: "var(--accent-soft, #ededfc)", border: "none", borderRadius: 8, padding: "6px 11px", cursor: "pointer" }}>すべて既読にする</button>}
      </div>
      <p style={{ fontSize: 13, color: "#7a8699", margin: "0 0 14px" }}>レベルUP・総力の大台突破・改名など、みんなの活躍を新しい順にお届け。</p>

      {err && <p style={{ color: "#e03131", fontSize: 13 }}>{err}</p>}
      {loading ? (
        <p style={{ color: "#868e96" }}>読み込み中…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "#868e96", fontSize: 14 }}>まだニュースはありません。編集が行われると、ここに出来事が並びます。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((n) => {
            const r = render(n);
            const idn = n.entityId && /^\d+$/.test(n.entityId) ? n.entityId : null;
            const unread = !isRead(n.id);
            const badge = unread
              ? <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent-strong, #4b3fc4)", background: "var(--accent-soft, #ededfc)", padding: "2px 7px", borderRadius: 999, flexShrink: 0 }}>未読</span>
              : <span style={{ fontSize: 10.5, fontWeight: 600, color: "#adb5bd", background: "#f1f3f5", padding: "2px 7px", borderRadius: 999, flexShrink: 0 }}>既読</span>;
            const inner = (
              <>
                <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{r.emoji}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: "#33404f", lineHeight: 1.5, fontWeight: unread ? 600 : 400 }}>{r.text}</span>
                {badge}
                <span style={{ fontSize: 11, color: "#adb5bd", flexShrink: 0, whiteSpace: "nowrap", width: 46, textAlign: "right" }}>{fmtWhen(n.ts)}</span>
              </>
            );
            const style = { display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", border: "1px solid var(--border, #eef1f4)", borderLeft: "3px solid " + r.accent, borderRadius: 10, background: unread ? "#f7f8fd" : "#fff", textDecoration: "none", color: "inherit" } as const;
            return idn
              ? <a key={n.id} href={"/city/" + idn} onClick={() => markRead([n.id])} style={{ ...style, cursor: "pointer" }}>{inner}</a>
              : <div key={n.id} onClick={() => markRead([n.id])} style={{ ...style, cursor: "pointer" }}>{inner}</div>;
          })}
          {!end && <button onClick={() => load(false)} disabled={more} style={{ ...btnGhost, justifyContent: "center", marginTop: 4 }}>{more ? "読み込み中…" : "もっと見る"}</button>}
        </div>
      )}
      <p style={{ marginTop: 16 }}><a href="/" style={{ ...btnGhost, textDecoration: "none" }}><Icon name="map" size={15} />地図に戻る</a></p>
    </div>
  );
}
