import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { listNews, hideNews, type NewsItem } from "../lib/api";
import { card, btnGhost } from "../lib/styles";
import { fcDisplay } from "../lib/sizes";
import { useDialog } from "./Dialog";
import Icon from "./Icon";

const KIND: Record<string, { emoji: string; accent: string; soft: string }> = {
  new: { emoji: "🎉", accent: "#2f9e44", soft: "#e9f8ee" },
  fc: { emoji: "🔥", accent: "#e8590c", soft: "#fff4e6" },
  power: { emoji: "💪", accent: "#1c7ed6", soft: "#e7f0fb" },
  rename: { emoji: "✏️", accent: "#6741d9", soft: "#ededfc" },
  music: { emoji: "🎵", accent: "#7048e8", soft: "#f3f0ff" },
  link: { emoji: "🔗", accent: "#0ca678", soft: "#e6fcf5" },
  move: { emoji: "📍", accent: "#0ca678", soft: "#e6fcf5" },
  bulkpower: { emoji: "📊", accent: "#1c7ed6", soft: "#e7f0fb" },
};
const kindOf = (k: string) => KIND[k] ?? { emoji: "•", accent: "#868e96", soft: "#f1f3f5" };

function renderText(n: NewsItem): ReactNode {
  switch (n.kind) {
    case "new": return <><strong>{n.name}</strong> が新しく仲間入り！</>;
    case "fc": return <><strong>{n.name}</strong> の溶鉱炉レベルが <strong>{fcDisplay(n.level || "")}</strong> に上がりました！</>;
    case "power": return <><strong>{n.name}</strong> の総力が <strong>{n.milestoneM}M</strong> を突破！</>;
    case "rename": return <><strong>{n.from}</strong> が <strong>{n.to}</strong> に改名しました</>;
    case "music": return <>新しい曲 <strong>{n.name}</strong> が追加されました</>;
    case "link": return <>新しいリンク <strong>{n.name}</strong> が追加されました</>;
    case "bulkpower": return <>総力を一括更新しました{n.count ? "（" + n.count + "都市）" : ""} <span style={{ color: "var(--accent, #1c7ed6)", fontWeight: 600 }}>ランキングを見る ›</span></>;
    default: return <>{n.name}</>;
  }
}
function linkTarget(n: NewsItem): string | null {
  if (n.kind === "music") return "/music";
  if (n.kind === "link") return "/links";
  if (n.kind === "bulkpower") return "/stats";
  return n.entityId && /^\d+$/.test(n.entityId) ? "/city/" + n.entityId : null;
}
function parseTs(ts: string): number { return Date.parse(ts.replace(" ", "T") + (ts.includes("Z") ? "" : "Z")); }
function fmtWhen(ts: string): string {
  const t = parseTs(ts); if (!Number.isFinite(t)) return ts;
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return min + "分前";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + "時間前";
  const dt = new Date(t);
  return (dt.getMonth() + 1) + "/" + dt.getDate() + " " + String(dt.getHours()).padStart(2, "0") + ":" + String(dt.getMinutes()).padStart(2, "0");
}
function dayInfo(ts: string): { key: string; label: string } {
  const t = parseTs(ts); const d = new Date(t);
  const key = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(t); b.setHours(0, 0, 0, 0);
  const diff = Math.round((a.getTime() - b.getTime()) / 86400000);
  const label = diff <= 0 ? "今日" : diff === 1 ? "昨日" : (d.getMonth() + 1) + "月" + d.getDate() + "日";
  return { key, label };
}

export default function NewsPage({ canEdit = false }: { canEdit?: boolean }) {
  const dlg = useDialog();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [end, setEnd] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [readSt, setReadSt] = useState<{ b: number; s: number[] }>(() => {
    try { const v = JSON.parse(localStorage.getItem("snw_news_read") || ""); if (v && typeof v.b === "number" && Array.isArray(v.s)) return { b: v.b, s: v.s }; } catch { /* noop */ }
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

  async function doHide(id: number) {
    if (!(await dlg.confirm({ title: "ニュースを非表示", message: "このお知らせを全員の一覧から消します。よろしいですか？", okLabel: "非表示にする", danger: true }))) return;
    try { await hideNews(id); setItems((prev) => prev.filter((n) => n.id !== id)); } catch (e) { setErr(String((e as Error).message || e)); }
  }

  const rows: ReactNode[] = [];
  let lastKey = "";
  for (const n of items) {
    const di = dayInfo(n.ts);
    if (di.key !== lastKey) { lastKey = di.key; rows.push(<div key={"h" + di.key} style={{ fontSize: 11.5, fontWeight: 700, color: "#adb5bd", margin: "10px 2px 2px", letterSpacing: "0.02em" }}>{di.label}</div>); }
    const k = kindOf(n.kind);
    const href = linkTarget(n);
    const unread = !isRead(n.id);
    const avatar = <span style={{ width: 38, height: 38, borderRadius: "50%", background: k.soft, color: k.accent, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{k.emoji}</span>;
    const body = (
      <>
        {avatar}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, color: "#1b2330", lineHeight: 1.45, fontWeight: unread ? 600 : 400 }}>{renderText(n)}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
            {unread && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent, #1c7ed6)", flexShrink: 0 }} />}
            <span style={{ fontSize: 11.5, color: "#adb5bd" }}>{fmtWhen(n.ts)}</span>
          </span>
        </span>
      </>
    );
    const clickStyle = { display: "flex", alignItems: "center", gap: 11, flex: 1, minWidth: 0, textDecoration: "none", color: "inherit", cursor: "pointer" } as const;
    rows.push(
      <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "9px 8px 9px 11px", border: "1px solid var(--border, #eef1f4)", borderLeft: "3px solid " + k.accent, borderRadius: 11, background: unread ? "#fbfbfe" : "#fff" }}>
        {href
          ? <a href={href} onClick={() => markRead([n.id])} style={clickStyle}>{body}</a>
          : <div onClick={() => markRead([n.id])} style={clickStyle}>{body}</div>}
        {canEdit && <button onClick={() => doHide(n.id)} aria-label="非表示にする" title="非表示にする" style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: "#c1c8d1", cursor: "pointer", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={15} /></button>}
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
        <span style={{ color: "var(--accent, #1c7ed6)", display: "inline-flex" }}><Icon name="star" size={20} /></span>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#1b2330" }}>同盟ニュース</h2>
        {unreadCount > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "var(--accent, #1c7ed6)", padding: "2px 9px", borderRadius: 999 }}>未読 {unreadCount}</span>}
        {unreadCount > 0 && <button onClick={markAllRead} style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: "var(--accent-strong, #4b3fc4)", background: "var(--accent-soft, #ededfc)", border: "none", borderRadius: 8, padding: "6px 11px", cursor: "pointer" }}>すべて既読にする</button>}
      </div>
      <p style={{ fontSize: 13, color: "#7a8699", margin: "0 0 12px" }}>レベルUP・総力の大台突破・改名・新しい曲やリンクなど、みんなの活躍を新しい順にお届け。</p>

      {err && <p style={{ color: "#e03131", fontSize: 13 }}>{err}</p>}
      {loading ? (
        <p style={{ color: "#868e96" }}>読み込み中…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "#868e96", fontSize: 14 }}>まだニュースはありません。編集が行われると、ここに出来事が並びます。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows}
          {!end && <button onClick={() => load(false)} disabled={more} style={{ ...btnGhost, justifyContent: "center", marginTop: 6 }}>{more ? "読み込み中…" : "もっと見る"}</button>}
        </div>
      )}
      <p style={{ marginTop: 16 }}><a href="/" style={{ ...btnGhost, textDecoration: "none" }}><Icon name="map" size={15} />地図に戻る</a></p>
    </div>
  );
}
