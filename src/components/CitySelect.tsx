import { useState, useRef, useEffect } from "react";
import Icon from "./Icon";

// 自分の都市の選択（あいまい検索つき）。compact=PCの切替バー用の小型表示。
// ドロップダウンは position:fixed で描画し、親の overflow に隠れないようにする。
export default function CitySelect({ cities, value, onSelect, compact }: { cities: { id: number; name: string }[]; value: number | null; onSelect: (id: number | null) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = compact ? Math.max(220, r.width) : r.width;
    let left = compact ? r.right - width : r.left;
    const maxLeft = window.innerWidth - width - 8;
    if (left > maxLeft) left = maxLeft;
    if (left < 8) left = 8;
    setPos({ top: r.bottom + 4, left, width });
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    // スマホはソフトキーボードの開閉でも resize が飛ぶ。閉じてしまうと入力できないので、
    // 幅が変わったとき（回転など）だけ閉じ、高さだけの変化は位置の再計算にとどめる。
    let w = window.innerWidth;
    const onResize = () => { if (window.innerWidth !== w) { w = window.innerWidth; setOpen(false); } else place(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    window.addEventListener("resize", onResize);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("touchstart", onDoc); window.removeEventListener("resize", onResize); };
  }, [open]);

  // 全角/半角・カナ/かなを吸収（NFKC＋カナ→ひらがな＋小文字）。
  const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const fuzzy = (query: string, name: string) => { const a = norm(query.trim()); if (!a) return true; const b = norm(name); let i = 0; for (const ch of b) { if (ch === a[i]) i++; if (i >= a.length) return true; } return b.includes(a); };
  const filtered = cities.filter((c) => fuzzy(q, c.name)).slice(0, 80);
  const cur = value != null ? cities.find((c) => c.id === value) : undefined;
  const pick = (id: number | null) => { onSelect(id); setOpen(false); setQ(""); };
  const toggle = () => { if (open) { setOpen(false); } else { place(); setQ(""); setOpen(true); } };

  return (
    <div ref={ref} style={{ position: "relative", width: compact ? undefined : "100%" }}>
      <button ref={btnRef} type="button" onClick={toggle} style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "space-between", width: compact ? undefined : "100%", maxWidth: compact ? 180 : undefined, minWidth: compact ? 130 : undefined, padding: compact ? "5px 10px" : "11px 12px", borderRadius: compact ? 7 : 10, border: "1px solid #ced4da", background: "#fff", cursor: "pointer", fontSize: compact ? 12 : 15, color: cur ? "#222" : "#868e96" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cur ? cur.name : "（未設定）"}</span>
        <Icon name="chevronDown" size={compact ? 13 : 16} style={{ color: "#868e96", transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && pos && (
        <div style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, background: "#fff", border: "1px solid #dee2e6", borderRadius: 10, boxShadow: "0 10px 28px rgba(0,0,0,0.22)", zIndex: 1000, overflow: "hidden" }}>
          <div style={{ padding: 8, borderBottom: "1px solid #f1f3f5" }}>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="都市名で絞り込み（あいまい可）" style={{ width: "100%", padding: "8px 10px", border: "1px solid #ced4da", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <div style={{ maxHeight: 280, overflow: "auto" }}>
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
