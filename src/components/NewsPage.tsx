import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { listNews, hideNews, type NewsItem } from "../lib/api";
import { card, btnGhost } from "../lib/styles";
import { fcDisplay } from "../lib/sizes";
import { useDialog } from "./Dialog";
import Icon from "./Icon";
import SwipeRow from "./SwipeRow";

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
  const [toast, setToast] = useState<string | null>(null);
  type ReadSt = { b: number; s: number[]; u: number[] };
  const [readSt, setReadSt] = useState<ReadSt>(() => {
    try { const v = JSON.parse(localStorage.getItem("snw_news_read") || ""); if (v && typeof v.b === "number" && Array.isArray(v.s)) return { b: v.b, s: v.s, u: Array.isArray(v.u) ? v.u : [] }; } catch { /* noop */ }
    try { const old = Number(localStorage.getItem("snw_news_read_id")) || 0; if (old > 0) return { b: old, s: [], u: [] }; } catch { /* noop */ }
    return { b: 0, s: [], u: [] };
  });
  const readSet = new Set(readSt.s);
  const unreadSet = new Set(readSt.u);
  const isRead = (id: number) => readSet.has(id) || (id <= readSt.b && !unreadSet.has(id));
  const unreadCount = items.filter((n) => !isRead(n.id)).length;
  const persistRead = (st: ReadSt) => { try { localStorage.setItem("snw_news_read", JSON.stringify({ b: st.b, s: st.s.filter((i) => i > st.b).sort((a, b) => b - a).slice(0, 1000), u: st.u.filter((i) => i <= st.b).sort((a, b) => b - a).slice(0, 1000) })); } catch { /* noop */ } };
  const notifyRead = () => { try { window.dispatchEvent(new CustomEvent("snw-news-read")); } catch { /* noop */ } };
  const apply = (next: ReadSt) => { persistRead(next); setReadSt(next); notifyRead(); };
  const markRead = (ids: number[]) => { const s = new Set(readSt.s); const u = new Set(readSt.u); ids.forEach((i) => { if (i <= readSt.b) u.delete(i); else s.add(i); }); apply({ b: readSt.b, s: [...s], u: [...u] }); };
  const setUnread = (id: number) => { const s = new Set(readSt.s); const u = new Set(readSt.u); if (id <= readSt.b) u.add(id); else s.delete(id); apply({ b: readSt.b, s: [...s], u: [...u] }); };
  const toggleRead = (id: number) => { if (isRead(id)) setUnread(id); else markRead([id]); };
  const markAllRead = () => { const max = items.reduce((m, n) => Math.max(m, n.id), readSt.b); apply({ b: max, s: [], u: [] }); };

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
    try { await hideNews(id); setItems((prev) => prev.filter((n) => n.id !== id)); setToast("このお知らせを非表示にしました"); window.setTimeout(() => setToast(null), 2200); } catch (e) { setErr(String((e as Error).message || e)); }
  }

  const rows: ReactNode[] = [];
  let lastKey = "";
  for (const n of items) {
    const di = dayInfo(n.ts);
    if (di.key !== lastKey) { lastKey = di.key; rows.push(<div key={"h" + di.key} style={{ fontSize: 11.5, fontWeight: 700, color: "#adb5bd", margin: "10px 2px 2px", letterSpacing: "0.02em" }}>{di.label}</div>); }
    const k = kindOf(n.kind);
    const href = linkTarget(n);
    const unread = !isRead(n.id);
    const avatar = <span style={{ width: 38, height: 38, borderRadius: "50%", background: unread ? k.soft : "#eceef1", color: unread ? k.accent : "#aab2bd", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, opacity: unread ? 1 : 0.7 }}>{k.emoji}</span>;
    const body = (
      <>
        {avatar}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, color: unread ? "#1b2330" : "#9aa3ae", lineHeight: 1.45, fontWeight: unread ? 600 : 400 }}>{renderText(n)}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
            {unread && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent, #1c7ed6)", flexShrink: 0 }} />}
            <span style={{ fontSize: 11.5, color: unread ? "#868e96" : "#b7bec7" }}>{fmtWhen(n.ts)}</span>
          </span>
        </span>
      </>
    );
    const clickStyle = { display: "flex", alignItems: "center", gap: 11, width: "100%", boxSizing: "border-box", minWidth: 0, textDecoration: "none", color: "inherit", cursor: "pointer", padding: "9px 11px", border: "1px solid " + (unread ? "var(--border, #eef1f4)" : "#e9ebef"), borderLeft: "3px solid " + (unread ? k.accent : "#cfd4da"), borderRadius: 11, background: unread ? "#fff" : "#f1f3f5" } as const;
    const card = href
      ? <a href={href} onClick={() => markRead([n.id])} style={clickStyle}>{body}</a>
      : <div onClick={() => markRead([n.id])} style={clickStyle}>{body}</div>;
    rows.push(
      <SwipeRow key={n.id} block radius={11} gap={0} bg="transparent" actionWidth={78} primaryInstant
        primary={{ icon: "check", label: unread ? "既読に" : "未読に", bg: unread ? "#2f9e44" : "#868e96", onAct: () => toggleRead(n.id) }}
        danger={canEdit ? { icon: "trash", label: "非表示", bg: "#e03131", onAct: () => doHide(n.id) } : undefined}>
        {card}
      </SwipeRow>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
        <span style={{ color: "var(--accent, #1c7ed6)", display: "inline-flex", flexShrink: 0 }}><Icon name="star" size={20} /></span>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#1b2330", whiteSpace: "nowrap", flexShrink: 0 }}>同盟ニュース</h2>
        {unreadCount > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "var(--accent, #1c7ed6)", padding: "2px 9px", borderRadius: 999, flexShrink: 0 }}>未読 {unreadCount}</span>}
      </div>
      <p style={{ fontSize: 13, color: "#7a8699", margin: "0 0 10px" }}>レベルUP・総力の大台突破・改名・新しい曲やリンクなど、みんなの活躍を新しい順にお届け。</p>
      {unreadCount > 0 && <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}><button onClick={markAllRead} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent-strong, #4b3fc4)", background: "var(--accent-soft, #ededfc)", border: "none", borderRadius: 8, padding: "7px 13px", cursor: "pointer" }}>すべて既読にする</button></div>}

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
      {toast && <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 50, background: "#1b2330", color: "#fff", fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: 999, boxShadow: "0 6px 20px rgba(0,0,0,0.28)" }}>{toast}</div>}
    </div>
  );
}
