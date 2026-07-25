import { useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Icon from "./Icon";
import { isDragActive } from "../lib/dragSignal";

// 一覧の行アクションを、スマホは左右スワイプで、PCはボタンで出す共通行。
// 右スワイプ→primary（主操作・左端から）、左スワイプ→danger（破壊的・右端から）。
export type SwipeAction = { icon: string; label: string; bg: string; onAct: () => void };
const COARSE = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

export default function SwipeRow({ children, contentStyle, bg = "var(--surface, #fff)", radius = 10, gap = 10, block = false, primary, danger, actionWidth = 78 }: {
  children: ReactNode;
  contentStyle?: CSSProperties;
  bg?: string;
  radius?: number;
  gap?: number;
  block?: boolean; // true=中身を縦積み（複数行カード）、false=横並び1行
  primary?: SwipeAction;
  danger?: SwipeAction;
  actionWidth?: number;
}) {
  const [open, setOpen] = useState<"p" | "d" | null>(null);
  const st = useRef<{ x: number; y: number; done: boolean } | null>(null);

  const down = (e: { clientX: number; clientY: number }) => { st.current = { x: e.clientX, y: e.clientY, done: false }; };
  const move = (e: { clientX: number; clientY: number }) => {
    const s = st.current; if (!s || s.done) return;
    if (isDragActive()) { st.current = null; return; } // 並べ替えドラッグ中はスワイプしない
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dy) > Math.abs(dx)) { if (Math.abs(dy) > 8) st.current = null; return; } // 縦スクロール優先
    if (dx > 30 && primary) { setOpen("p"); s.done = true; }
    else if (dx < -30 && danger) { setOpen("d"); s.done = true; }
  };
  const up = () => { st.current = null; };

  const deskBtn = (b: string): CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, padding: "7px 12px", border: "none", borderRadius: 9, background: b, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" });

  // PC：ボタンを行末に常時表示
  if (!COARSE) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: bg, borderRadius: radius, ...contentStyle }}>
        <div style={{ flex: 1, minWidth: 0, ...(block ? {} : { display: "flex", alignItems: "center", gap }) }}>{children}</div>
        {primary && <button onClick={primary.onAct} title={primary.label} style={deskBtn(primary.bg)}><Icon name={primary.icon} size={14} />{primary.label}</button>}
        {danger && <button onClick={danger.onAct} title={danger.label} style={deskBtn(danger.bg)}><Icon name={danger.icon} size={14} />{danger.label}</button>}
      </div>
    );
  }

  // スマホ：左右スワイプで出す
  const act = (a: SwipeAction, side: "left" | "right"): CSSProperties => ({ position: "absolute", top: 0, bottom: 0, ...(side === "left" ? { left: 0 } : { right: 0 }), width: actionWidth, border: "none", background: a.bg, color: "#fff", cursor: "pointer", display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, fontSize: 11, fontWeight: 700 });
  const tx = open === "p" ? "translateX(" + actionWidth + "px)" : open === "d" ? "translateX(-" + actionWidth + "px)" : "translateX(0)";
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: radius }}>
      {primary && <button onClick={() => { setOpen(null); primary.onAct(); }} aria-label={primary.label} style={act(primary, "left")}><Icon name={primary.icon} size={16} />{primary.label}</button>}
      {danger && <button onClick={() => { setOpen(null); danger.onAct(); }} aria-label={danger.label} style={act(danger, "right")}><Icon name={danger.icon} size={16} />{danger.label}</button>}
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClickCapture={(e) => { if (open) { e.stopPropagation(); e.preventDefault(); setOpen(null); } }} style={{ position: "relative", ...(block ? {} : { display: "flex", alignItems: "center", gap }), background: bg, touchAction: "pan-y", transform: tx, transition: "transform 0.2s ease", ...contentStyle }}>{children}</div>
    </div>
  );
}
