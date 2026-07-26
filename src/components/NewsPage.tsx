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
      </div>
      <p style={{ fontSize: 13, color: "#7a8699", margin: "0 0 14px" }}>レベルUP・総力の大台突破・改名・移動など、みんなの活躍を新しい順にお届け。</p>

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
            const inner = (
              <>
                <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{r.emoji}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: "#33404f", lineHeight: 1.5 }}>{r.text}</span>
                <span style={{ fontSize: 11, color: "#adb5bd", flexShrink: 0, whiteSpace: "nowrap" }}>{fmtWhen(n.ts)}</span>
              </>
            );
            const style = { display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", border: "1px solid var(--border, #eef1f4)", borderLeft: "3px solid " + r.accent, borderRadius: 10, background: "#fff", textDecoration: "none", color: "inherit" } as const;
            return idn ? <a key={n.id} href={"/city/" + idn} style={{ ...style, cursor: "pointer" }}>{inner}</a> : <div key={n.id} style={style}>{inner}</div>;
          })}
          {!end && <button onClick={() => load(false)} disabled={more} style={{ ...btnGhost, justifyContent: "center", marginTop: 4 }}>{more ? "読み込み中…" : "もっと見る"}</button>}
        </div>
      )}
      <p style={{ marginTop: 16 }}><a href="/" style={{ ...btnGhost, textDecoration: "none" }}><Icon name="map" size={15} />地図に戻る</a></p>
    </div>
  );
}
