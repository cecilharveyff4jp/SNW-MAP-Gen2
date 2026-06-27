import { useState, useRef, useEffect } from "react";
import Icon from "./Icon";

// 自分の都市の選択（あいまい検索つき）。compact=PCの切替バー用の小型表示。
export default function CitySelect({ cities, value, onSelect, compact }: { cities: { id: number; name: string }[]; value: number | null; onSelect: (id: number | null) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const fuzzy = (query: string, name: string) => { const a = query.toLowerCase().trim(); if (!a) return true; const b = name.toLowerCase(); let i = 0; for (const ch of b) { if (ch === a[i]) i++; if (i >= a.length) return true; } return b.includes(a); };
  const filtered = cities.filter((c) => fuzzy(q, c.name)).slice(0, 80);
  const cur = value != null ? cities.find((c) => c.id === value) : undefined;
  const pick = (id: number | null) => { onSelect(id); setOpen(false); setQ(""); };

  return (
    <div ref={ref} style={{ position: "relative", width: compact ? undefined : "100%" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "space-between", width: compact ? undefined : "100%", maxWidth: compact ? 170 : undefined, padding: compact ? "5px 10px" : "11px 12px", borderRadius: compact ? 7 : 10, border: "1px solid #ced4da", background: "#fff", cursor: "pointer", fontSize: compact ? 12 : 15, color: cur ? "#222" : "#868e96" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cur ? cur.name : "（未設定）"}</span>
        <Icon name="chevronDown" size={compact ? 13 : 16} style={{ color: "#868e96" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", right: compact ? 0 : undefined, left: compact ? undefined : 0, width: compact ? 220 : "100%", background: "#fff", border: "1px solid #dee2e6", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 30, overflow: "hidden" }}>
          <div style={{ padding: 8, borderBottom: "1px solid #f1f3f5" }}>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="都市名で絞り込み（あいまい可）" style={{ width: "100%", padding: "8px 10px", border: "1px solid #ced4da", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <div style={{ maxHeight: 260, overflow: "auto" }}>
            <button type="button" onClick={() => pick(null)} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: "none", borderBottom: "1px solid #f6f7f9", background: value == null ? "var(--accent-soft, #eef2f9)" : "#fff", color: "#868e96", fontSize: 13.5, cursor: "pointer" }}>（未設定）</button>
            {filtered.length === 0 ? <div style={{ padding: 12, color: "#868e96", fontSize: 13 }}>該当なし</div> : filtered.map((c) => (
              <button key={c.id} type="button" onClick={() => pick(c.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: "none", borderBottom: "1px solid #f6f7f9", background: value === c.id ? "var(--accent-soft, #eef2f9)" : "#fff", color: "#222", fontSize: 14, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
