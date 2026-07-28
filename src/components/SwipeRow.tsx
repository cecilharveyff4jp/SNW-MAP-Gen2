import { useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Icon from "./Icon";
import { isDragActive } from "../lib/dragSignal";

// 一覧の行アクション。スマホは左右スワイプ、PCはボタン。
// 右スワイプ→primary（左端）、左スワイプ→danger（右端）。
// primaryInstant=true のとき、右スワイプは「ボタンを出さず即実行」（指追従→しきい値超えで確定）。
export type SwipeAction = { icon: string; label: string; bg: string; onAct: () => void };
const COARSE = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

export default function SwipeRow({ children, contentStyle, bg = "var(--surface, #fff)", radius = 10, gap = 10, block = false, primary, danger, actionWidth = 78, primaryInstant = false }: {
  children: ReactNode;
  contentStyle?: CSSProperties;
  bg?: string;
  radius?: number;
  gap?: number;
  block?: boolean;
  primary?: SwipeAction;
  danger?: SwipeAction;
  actionWidth?: number;
  primaryInstant?: boolean;
}) {
  const [open, setOpen] = useState<"p" | "d" | null>(null);
  const [dx, setDx] = useState(0);
  const st = useRef<{ x: number; y: number; done: boolean; mode: "" | "instant"; lastDx: number } | null>(null);
  const instantRef = useRef(0);

  const down = (e: { clientX: number; clientY: number }) => { st.current = { x: e.clientX, y: e.clientY, done: false, mode: "", lastDx: 0 }; };
  const move = (e: { clientX: number; clientY: number }) => {
    const s = st.current; if (!s || s.done) return;
    if (isDragActive()) { st.current = null; return; }
    const ddx = e.clientX - s.x, ddy = e.clientY - s.y;
    if (Math.abs(ddy) > Math.abs(ddx)) { if (Math.abs(ddy) > 8) { st.current = null; if (dx) setDx(0); } return; }
    if (primaryInstant && primary && ddx > 4) { s.mode = "instant"; s.lastDx = ddx; setDx(Math.min(ddx, actionWidth + 24)); return; }
    if (ddx > 30 && primary && !primaryInstant) { setOpen("p"); s.done = true; }
    else if (ddx < -30 && danger) { setOpen("d"); s.done = true; }
  };
  const up = () => {
    const s = st.current; st.current = null;
    if (s && s.mode === "instant") {
      if (s.lastDx > 8) instantRef.current = Date.now();
      const fire = s.lastDx >= 50;
      setDx(0);
      if (fire && primary) primary.onAct();
    }
  };

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

  const act = (a: SwipeAction, side: "left" | "right"): CSSProperties => ({ position: "absolute", top: 0, bottom: 0, ...(side === "left" ? { left: 0 } : { right: 0 }), width: actionWidth, border: "none", background: a.bg, color: "#fff", cursor: "pointer", display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, fontSize: 11, fontWeight: 700 });
  const tx = dx ? "translateX(" + dx + "px)" : open === "p" ? "translateX(" + actionWidth + "px)" : open === "d" ? "translateX(-" + actionWidth + "px)" : "translateX(0)";
  const showHint = primaryInstant && !!primary;
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: radius }}>
      {primary && (showHint
        ? <div aria-hidden="true" style={{ ...act(primary, "left"), pointerEvents: "none", opacity: dx > 6 ? 1 : 0, transition: "opacity 0.12s ease" }}><Icon name={primary.icon} size={16} />{primary.label}</div>
        : <button onClick={() => { setOpen(null); primary.onAct(); }} aria-label={primary.label} style={act(primary, "left")}><Icon name={primary.icon} size={16} />{primary.label}</button>)}
      {danger && <button onClick={() => { setOpen(null); danger.onAct(); }} aria-label={danger.label} style={act(danger, "right")}><Icon name={danger.icon} size={16} />{danger.label}</button>}
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClickCapture={(e) => { if (open) { e.stopPropagation(); e.preventDefault(); setOpen(null); } else if (Date.now() - instantRef.current < 350) { e.stopPropagation(); e.preventDefault(); } }}
        style={{ position: "relative", ...(block ? {} : { display: "flex", alignItems: "center", gap }), background: bg, touchAction: "pan-y", transform: tx, transition: dx ? "none" : "transform 0.2s ease", ...contentStyle }}>{children}</div>
    </div>
  );
}
