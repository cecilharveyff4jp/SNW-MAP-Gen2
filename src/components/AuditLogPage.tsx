import { useEffect, useState } from "react";
import type { Me } from "../lib/api";
import { listAuditLog, type AuditEntry } from "../lib/api";
import { card, btnGhost } from "../lib/styles";
import Icon from "./Icon";

const ACTION: Record<string, { text: string; bg: string; color: string }> = {
  create: { text: "作成", bg: "#e9f8ee", color: "#2b8a3e" },
  update: { text: "変更", bg: "#e7f0fb", color: "#1b5fa8" },
  place: { text: "配置", bg: "#e6fcf5", color: "#0ca678" },
  unplace: { text: "プールへ", bg: "#fff4e6", color: "#e8730c" },
  delete: { text: "削除", bg: "#fdecec", color: "#d6403a" },
  rename: { text: "改名", bg: "#e7f0fb", color: "#1b5fa8" },
  copy: { text: "複製", bg: "#f3f0ff", color: "#6741d9" },
  approve: { text: "承認", bg: "#e9f8ee", color: "#2b8a3e" },
  reject: { text: "却下", bg: "#fdecec", color: "#d6403a" },
};
const ENTITY: Record<string, string> = { object: "オブジェクト", map: "マップ", user: "ユーザー" };
const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "すべて" },
  { key: "object", label: "オブジェクト" },
  { key: "map", label: "マップ" },
  { key: "user", label: "ユーザー" },
];

function fmtVal(v: unknown): string {
  if (v == null || v === "") return "（空）";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function fmtWhen(ts: string): string {
  const t = Date.parse(ts.replace(" ", "T") + (ts.includes("Z") ? "" : "Z"));
  if (!Number.isFinite(t)) return ts;
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return (d.getMonth() + 1) + "/" + d.getDate() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

export default function AuditLogPage({ me }: { me: Me | null }) {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [end, setEnd] = useState(false);
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (id: number) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const isOwner = me?.isOwner === true;

  function shortActor(email: string | null): string {
    if (!email) return "—";
    const at = email.indexOf("@");
    return at > 0 ? email.slice(0, at) : email;
  }

  async function load(reset: boolean) {
    if (reset) { setLoading(true); setEnd(false); } else setMore(true);
    try {
      const before = reset ? undefined : items[items.length - 1]?.id;
      const rows = await listAuditLog({ entity: filter || undefined, before, limit: 50 });
      setItems((prev) => (reset ? rows : [...prev, ...rows]));
      if (rows.length < 50) setEnd(true);
      setErr(null);
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setLoading(false); setMore(false); }
  }
  useEffect(() => { if (isOwner) load(true); else if (me?.email) setLoading(false); /* eslint-disable-next-line */ }, [filter, isOwner, me]);

  const back = <p style={{ marginTop: 16 }}><a href="/" style={{ ...btnGhost, textDecoration: "none" }}><Icon name="map" size={15} />地図に戻る</a></p>;

  if (me && me.email != null && !isOwner) {
    return (<div style={card}><p style={{ marginTop: 0 }}>この画面はオーナー専用です。</p>{back}</div>);
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
        <span style={{ color: "var(--accent, #1c7ed6)", display: "inline-flex" }}><Icon name="refresh" size={20} /></span>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#1b2330" }}>操作履歴</h2>
      </div>
      <p style={{ fontSize: 13, color: "#7a8699", margin: "0 0 12px" }}>誰がいつ何を変更したかの記録です。新しい順に50件ずつ表示します（行をタップで詳細）。</p>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid " + (on ? "var(--accent, #1c7ed6)" : "var(--border, #e3e8ef)"), background: on ? "var(--accent-soft, #e7f0fb)" : "#fff", color: on ? "var(--accent-strong, #1b5fa8)" : "#5a6477", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{f.label}</button>
          );
        })}
      </div>

      {err && <p style={{ color: "#e03131", fontSize: 13 }}>{err}</p>}
      {loading ? (
        <p style={{ color: "#868e96" }}>読み込み中…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "#868e96", fontSize: 14 }}>記録はまだありません。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((it) => {
            const a = ACTION[it.action] ?? { text: it.action, bg: "#f1f3f5", color: "#868e96" };
            const detail = it.detail && typeof it.detail === "object" ? (it.detail as Record<string, unknown>) : null;
            const hasDetail = !!detail && Object.keys(detail).length > 0;
            const open = expanded.has(it.id);
            return (
              <div key={it.id} style={{ border: "1px solid var(--border, #eef1f4)", borderRadius: 9 }}>
                <button onClick={() => hasDetail && toggle(it.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", background: "transparent", border: "none", cursor: hasDetail ? "pointer" : "default", textAlign: "left" }}>
                  <span style={{ fontSize: 11, color: "#adb5bd", flexShrink: 0, width: 62, fontVariantNumeric: "tabular-nums" }}>{fmtWhen(it.ts)}</span>
                  <span style={{ background: a.bg, color: a.color, fontWeight: 700, fontSize: 10.5, padding: "2px 7px", borderRadius: 6, flexShrink: 0 }}>{a.text}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ color: "#adb5bd", fontSize: 11 }}>{ENTITY[it.entity] ?? it.entity} </span>
                    <strong>{it.label || (it.entityId ? "#" + it.entityId : "—")}</strong>
                  </span>
                  <span style={{ fontSize: 10.5, color: "#c1c8d1", flexShrink: 0, maxWidth: 74, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortActor(it.actorEmail)}</span>
                  {hasDetail && <span style={{ flexShrink: 0, color: "#adb5bd", fontSize: 10, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>}
                </button>
                {open && hasDetail && detail && (
                  <div style={{ padding: "0 10px 9px 72px", display: "flex", flexDirection: "column", gap: 3 }}>
                    {Object.entries(detail).map(([k, v]) => (
                      <div key={k} style={{ fontSize: 12.5, color: "#495057" }}>
                        <span style={{ color: "#868e96" }}>{k}: </span>
                        {Array.isArray(v) && v.length === 2 ? (
                          <span><span style={{ color: "#adb5bd" }}>{fmtVal(v[0])}</span> → <strong>{fmtVal(v[1])}</strong></span>
                        ) : (
                          <span>{fmtVal(v)}</span>
                        )}
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "#adb5bd", marginTop: 2 }}>{it.actorEmail || "（不明）"}</div>
                  </div>
                )}
              </div>
            );
          })}
          {!end && <button onClick={() => load(false)} disabled={more} style={{ ...btnGhost, justifyContent: "center", marginTop: 6 }}>{more ? "読み込み中…" : "もっと見る（次の50件）"}</button>}
        </div>
      )}
      {back}
    </div>
  );
}
