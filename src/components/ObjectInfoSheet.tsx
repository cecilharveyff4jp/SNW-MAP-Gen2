import { useEffect, useRef, useState } from "react";
import type { PointerEvent as RPE } from "react";
import type { MusicItem } from "../lib/api";
import Icon from "./Icon";
import FcBadge from "./FcBadge";

interface Obj {
  type: string;
  label?: string;
  memberName?: string;
  anchorX: number;
  anchorY: number;
  fcLevel?: string;
  gameId?: string;
  birthday?: string;
  note?: string;
  musicIds?: number[];
}

export default function ObjectInfoSheet({ obj, music, onClose, onPlay }: { obj: Obj; music: MusicItem[]; onClose: () => void; onPlay: (m: MusicItem) => void }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [sheetH, setSheetH] = useState(0);
  const [peek, setPeek] = useState(150);
  const startRef = useRef<{ y: number; base: number; moved: boolean }>({ y: 0, base: 0, moved: false });

  const items = music.filter((mm) => (obj.musicIds ?? []).includes(mm.id));
  const isCity = obj.type === "CITY";
  const showFc = isCity || !!obj.fcLevel;
  const hasMore = !!obj.gameId || !!obj.note || items.length > 0;
  const name = obj.label || obj.memberName || "（名称なし）";

  useEffect(() => {
    if (sheetRef.current) setSheetH(sheetRef.current.offsetHeight);
    if (headRef.current) setPeek(headRef.current.offsetHeight);
  }, [music, obj]);

  const collapsedY = Math.max(0, sheetH - peek);
  const baseY = expanded ? 0 : collapsedY;
  const translateY = drag != null ? drag : baseY;

  const onDown = (e: RPE<HTMLDivElement>) => { e.currentTarget.setPointerCapture?.(e.pointerId); startRef.current = { y: e.clientY, base: baseY, moved: false }; setDrag(baseY); };
  const onMove = (e: RPE<HTMLDivElement>) => { if (drag == null) return; const dy = e.clientY - startRef.current.y; if (Math.abs(dy) > 4) startRef.current.moved = true; setDrag(Math.min(collapsedY, Math.max(0, startRef.current.base + dy))); };
  const onUp = () => { if (drag == null) return; const moved = startRef.current.moved; const v = drag; setDrag(null); if (!moved) { if (hasMore) setExpanded((x) => !x); return; } setExpanded(v < collapsedY / 2); };

  return (
    <div ref={sheetRef} style={{ position: "absolute", left: 0, right: 0, bottom: 0, margin: "0 auto", maxWidth: 460, background: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, boxShadow: "0 -8px 30px rgba(0,0,0,0.22)", zIndex: 10, transform: "translateY(" + translateY + "px)", transition: drag == null ? "transform 0.26s cubic-bezier(0.2,0.8,0.2,1)" : "none", maxHeight: "82vh", display: "flex", flexDirection: "column" }}>
      {/* 常に見える部分（ピーク） */}
      <div ref={headRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} style={{ padding: "10px 16px 10px", cursor: "grab", touchAction: "none", flexShrink: 0 }}>
        <div style={{ width: 42, height: 5, borderRadius: 3, background: "#dee2e6", margin: "0 auto 10px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong style={{ fontSize: 17, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</strong>
            <div style={{ fontSize: 12.5, color: "#868e96", marginTop: 4 }}>座標 X:{obj.anchorX} Y:{obj.anchorY}</div>
            {showFc && <div style={{ marginTop: 6 }}><FcBadge fc={obj.fcLevel} imgSize={24} lv fallback={<span style={{ fontSize: 13, color: "#adb5bd", fontWeight: 600 }}>未設定</span>} /></div>}
            {isCity && <div style={{ fontSize: 13.5, color: "#495057", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}><Icon name="gift" size={14} />{obj.birthday ? obj.birthday : "未登録"}</div>}
          </div>
          <button onClick={onClose} aria-label="閉じる" style={{ border: "none", background: "#f1f3f5", borderRadius: 16, width: 32, height: 32, color: "#868e96", cursor: "pointer", fontSize: 18, flexShrink: 0 }}>×</button>
        </div>
        {hasMore && <div style={{ fontSize: 11, color: "#adb5bd", textAlign: "center", marginTop: 9 }}>{expanded ? "▼ 引き下げて閉じる" : "▲ 引き上げて詳細" + (items.length ? "・" + items.length + "曲" : "") + "を見る"}</div>}
      </div>
      {/* 広げると見える部分 */}
      <div style={{ overflowY: "auto", padding: "2px 16px 22px", flex: 1, borderTop: "1px solid #f1f3f5" }}>
        {obj.gameId && <div style={{ fontSize: 13, color: "#868e96", marginTop: 10 }}>ゲーム内ID: <span style={{ color: "#495057", fontWeight: 600 }}>{obj.gameId}</span></div>}
        {obj.note && <div style={{ fontSize: 13.5, color: "#495057", whiteSpace: "pre-wrap", lineHeight: 1.6, marginTop: 10 }}>{obj.note}</div>}
        {items.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11.5, color: "#868e96", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}><Icon name="music" size={13} />関連する曲（{items.length}）</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((mm) => (
                <button key={mm.id} onClick={() => onPlay(mm)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", border: "1px solid #eef1f4", borderRadius: 12, padding: "10px 12px", background: "#fff", cursor: "pointer" }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#7048e8,#9775fa)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15 }}>▶</span>
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mm.title || "（タイトルなし）"}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
