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

export default function ObjectInfoSheet({ obj, music, onClose, onPlay, onSuggest, dock = false, dark = false, isMyCity = false, onSetMyCity, canEdit = false, onEdit }: { obj: Obj; music: MusicItem[]; onClose: () => void; onPlay: (m: MusicItem) => void; onSuggest?: () => void; dock?: boolean; dark?: boolean; isMyCity?: boolean; onSetMyCity?: () => void; canEdit?: boolean; onEdit?: () => void }) {
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

  const musicList = (compact: boolean) => items.length > 0 && (
    <div style={{ marginTop: compact ? 0 : 14 }}>
      <div style={{ fontSize: 11.5, color: dark ? "#9fb0c4" : "#868e96", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}><Icon name="music" size={13} />関連する曲（{items.length}）</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((mm) => (
          <button key={mm.id} onClick={() => onPlay(mm)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", border: "1px solid " + (dark ? "rgba(255,255,255,0.12)" : "var(--border, #eef1f4)"), borderRadius: 12, padding: "10px 12px", background: dark ? "rgba(255,255,255,0.05)" : "#fff", cursor: "pointer" }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#7048e8,#9775fa)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="play" size={15} /></span>
            <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, color: dark ? "#e6edf5" : "#1f2630", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mm.title || "（タイトルなし）"}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const suggestBtn = onSuggest && (
    <button onClick={onSuggest} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", marginTop: 16, padding: "11px", border: "1px solid var(--accent, #5b5bd6)", borderRadius: 10, background: dark ? "rgba(91,91,214,0.16)" : "#fff", color: dark ? "#b9b6f0" : "var(--accent, #5b5bd6)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}><Icon name="edit" size={16} />変更を提案する</button>
  );

  // --- PC: 右からのガラス詳細ドック ---
  if (dock) {
    const muted = dark ? "#9fb0c4" : "#7a8699";
    const val = dark ? "#e6edf5" : "#33404f";
    return (
      <div style={{ position: "absolute", top: 12, right: 12, bottom: 12, width: 304, maxWidth: "calc(100% - 24px)", zIndex: 10, display: "flex", flexDirection: "column", borderRadius: 16, overflow: "hidden", background: dark ? "rgba(20,26,36,0.82)" : "rgba(255,255,255,0.88)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid " + (dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.9)"), boxShadow: "0 18px 44px -12px rgba(15,23,42,0.42)" }}>
        <div style={{ background: "var(--accent, #5b5bd6)", color: "#fff", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ fontSize: 16, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</strong>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 3 }}>X {obj.anchorX} · Y {obj.anchorY}</div>
          </div>
          <button onClick={onClose} aria-label="閉じる" style={{ border: "none", background: "rgba(255,255,255,0.22)", borderRadius: 15, width: 30, height: 30, color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="close" size={16} /></button>
        </div>
        {(onSetMyCity || (canEdit && onEdit)) && (
          <div style={{ display: "flex", gap: 8, padding: "12px 16px 0", flexShrink: 0 }}>
            {onSetMyCity && <button onClick={onSetMyCity} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 10px", borderRadius: 10, border: "1px solid " + (isMyCity ? "#f0b429" : (dark ? "rgba(255,255,255,0.14)" : "var(--border, #e3e8ef)")), background: isMyCity ? "rgba(240,180,41,0.16)" : (dark ? "rgba(255,255,255,0.05)" : "#fff"), color: isMyCity ? "#ca8a04" : (dark ? "#dfe7f1" : "#33404f"), fontSize: 13, fontWeight: 600, cursor: "pointer" }}><Icon name="star" size={15} />{isMyCity ? "自分の都市" : "自分の都市に"}</button>}
            {canEdit && onEdit && <button onClick={onEdit} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 10px", borderRadius: 10, border: "none", background: "var(--accent, #5b5bd6)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}><Icon name="edit" size={15} />編集</button>}
          </div>
        )}
        <div style={{ overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 11 }}>
          {showFc && <div style={{ display: "flex", alignItems: "center", gap: 8 }}><FcBadge fc={obj.fcLevel} imgSize={24} lv fallback={<span style={{ fontSize: 13, color: muted, fontWeight: 600 }}>FC 未設定</span>} /></div>}
          {isCity && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 4, borderTop: "1px solid " + (dark ? "rgba(255,255,255,0.08)" : "#eef1f4") }}><span style={{ color: muted, display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="gift" size={14} />誕生日</span><span style={{ color: val }}>{obj.birthday || "未登録"}</span></div>}
          {obj.gameId && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 4, borderTop: "1px solid " + (dark ? "rgba(255,255,255,0.08)" : "#eef1f4") }}><span style={{ color: muted }}>ゲーム内ID</span><span style={{ color: val }}>{obj.gameId}</span></div>}
          {obj.note && <div style={{ fontSize: 13.5, color: dark ? "#cdd6e3" : "#495057", whiteSpace: "pre-wrap", lineHeight: 1.6, paddingTop: 6, borderTop: "1px solid " + (dark ? "rgba(255,255,255,0.08)" : "#eef1f4") }}>{obj.note}</div>}
          {musicList(false)}
          {suggestBtn}
        </div>
      </div>
    );
  }

  // --- スマホ: 下から上がるシート ---
  const collapsedY = Math.max(0, sheetH - peek);
  const baseY = expanded ? 0 : collapsedY;
  const translateY = drag != null ? drag : baseY;

  const onDown = (e: RPE<HTMLDivElement>) => { e.currentTarget.setPointerCapture?.(e.pointerId); startRef.current = { y: e.clientY, base: baseY, moved: false }; setDrag(baseY); };
  const onMove = (e: RPE<HTMLDivElement>) => { if (drag == null) return; const dy = e.clientY - startRef.current.y; if (Math.abs(dy) > 4) startRef.current.moved = true; setDrag(Math.min(collapsedY, Math.max(0, startRef.current.base + dy))); };
  const onUp = () => { if (drag == null) return; const moved = startRef.current.moved; const v = drag; setDrag(null); if (!moved) { if (hasMore) setExpanded((x) => !x); return; } setExpanded(v < collapsedY / 2); };

  return (
    <div ref={sheetRef} style={{ position: "absolute", left: 0, right: 0, bottom: 0, margin: "0 auto", maxWidth: 460, background: "var(--surface, #fff)", borderTopLeftRadius: 18, borderTopRightRadius: 18, boxShadow: "0 -8px 30px rgba(0,0,0,0.22)", zIndex: 10, transform: "translateY(" + translateY + "px)", transition: drag == null ? "transform 0.26s cubic-bezier(0.2,0.8,0.2,1)" : "none", maxHeight: "82vh", display: "flex", flexDirection: "column" }}>
      <div ref={headRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} style={{ cursor: "grab", touchAction: "none", flexShrink: 0 }}>
        <div style={{ background: "var(--accent, #1c7ed6)", color: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: "10px 16px 12px" }}>
          <div style={{ width: 42, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.55)", margin: "0 auto 10px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong style={{ fontSize: 17, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</strong>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>座標 X:{obj.anchorX} Y:{obj.anchorY}</div>
            </div>
            <button onClick={onClose} aria-label="閉じる" style={{ border: "none", background: "rgba(255,255,255,0.22)", borderRadius: 16, width: 32, height: 32, color: "#fff", cursor: "pointer", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={18} /></button>
          </div>
        </div>
        {(showFc || isCity || hasMore) && (
          <div style={{ padding: "10px 16px 10px" }}>
            {showFc && <div style={{ marginBottom: isCity ? 6 : 0 }}><FcBadge fc={obj.fcLevel} imgSize={24} lv fallback={<span style={{ fontSize: 13, color: "#adb5bd", fontWeight: 600 }}>未設定</span>} /></div>}
            {isCity && <div style={{ fontSize: 13.5, color: "#495057", display: "flex", alignItems: "center", gap: 6 }}><Icon name="gift" size={14} />{obj.birthday ? obj.birthday : "未登録"}</div>}
            {hasMore && <div style={{ fontSize: 11, color: "#adb5bd", textAlign: "center", marginTop: 9 }}>{expanded ? "▼ 引き下げて閉じる" : "▲ 引き上げて詳細" + (items.length ? "・" + items.length + "曲" : "") + "を見る"}</div>}
          </div>
        )}
      </div>
      <div style={{ overflowY: "auto", padding: "2px 16px 22px", flex: 1, borderTop: "1px solid var(--border, #f1f3f5)" }}>
        {obj.gameId && <div style={{ fontSize: 13, color: "#868e96", marginTop: 10 }}>ゲーム内ID: <span style={{ color: "#495057", fontWeight: 600 }}>{obj.gameId}</span></div>}
        {obj.note && <div style={{ fontSize: 13.5, color: "#495057", whiteSpace: "pre-wrap", lineHeight: 1.6, marginTop: 10 }}>{obj.note}</div>}
        {musicList(false)}
        {suggestBtn}
      </div>
    </div>
  );
}
