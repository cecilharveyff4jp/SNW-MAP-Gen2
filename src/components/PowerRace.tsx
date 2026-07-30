import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

export interface RaceCity { id: number; name: string; points: { t: number; v: number }[]; }

const DUR = 13000;      // 全区間の再生時間(ms) @1x
const TARGET_VISIBLE = 30; // 画面に見せたい行数（残りはスクロール）

function interp(pts: { t: number; v: number }[], t: number): number {
  if (pts.length === 0) return 0;
  if (t <= pts[0].t) return pts[0].v;
  const last = pts[pts.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i].t) { const a = pts[i - 1], b = pts[i]; const f = (t - a.t) / ((b.t - a.t) || 1); return a.v + (b.v - a.v) * f; }
  }
  return last.v;
}

const MED = ["#f2c200", "#cfd3dc", "#e08a4b"];

export default function PowerRace({ cities, selfId, onClose }: {
  cities: RaceCity[];
  selfId: number | null;
  onClose: () => void;
}) {
  const [minT, maxT] = useMemo(() => {
    let mn = Infinity, mx = -Infinity;
    for (const c of cities) for (const p of c.points) { if (p.t < mn) mn = p.t; if (p.t > mx) mx = p.t; }
    return [mn, mx];
  }, [cities]);
  const hasRange = Number.isFinite(minT) && maxT > minT;
  const colors = useMemo(() => cities.map((c) => (c.id === selfId ? "#ffe08a" : `hsl(${(c.id * 47) % 360} 62% 60%)`)), [cities, selfId]);
  const selfIdx = cities.findIndex((c) => c.id === selfId);

  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [rowH, setRowH] = useState(22);

  const pRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const rowHRef = useRef(22);
  const lastRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const barRefs = useRef<Array<HTMLDivElement | null>>([]);
  const valRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const rankRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const rankNum = useRef<number[]>(cities.map(() => -1));
  const flashTimers = useRef<number[]>([]);
  const selfRankRef = useRef(0);
  const clockRef = useRef<HTMLDivElement | null>(null);
  const scrubRef = useRef<HTMLInputElement | null>(null);
  const selfChipRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { rowHRef.current = rowH; rankNum.current = cities.map(() => -1); }, [rowH, cities]);

  // 行高を「約30行見える」ように画面高さから算出
  useEffect(() => {
    const calc = () => {
      const h = boardRef.current?.clientHeight || Math.max(200, window.innerHeight - 160);
      setRowH(Math.max(18, Math.min(30, Math.round(h / TARGET_VISIBLE))));
    };
    calc();
    const t = window.setTimeout(calc, 60);
    window.addEventListener("resize", calc);
    return () => { window.removeEventListener("resize", calc); window.clearTimeout(t); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => () => { flashTimers.current.forEach((t) => window.clearTimeout(t)); }, []);

  useEffect(() => {
    if (!hasRange) return;
    const frame = (ts: number) => {
      if (lastRef.current == null) lastRef.current = ts;
      const dt = ts - lastRef.current; lastRef.current = ts;
      if (playingRef.current) {
        pRef.current += (dt / DUR) * speedRef.current;
        if (pRef.current >= 1) { pRef.current = 1; playingRef.current = false; setPlaying(false); }
      }
      render();
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRange]);

  function render() {
    const H = rowHRef.current;
    const t = minT + pRef.current * (maxT - minT);
    const vals = cities.map((c, i) => ({ i, v: interp(c.points, t) }));
    vals.sort((a, b) => b.v - a.v);
    const maxV = vals[0]?.v || 1;
    // 見えている範囲だけ幅/数字を更新（100人でも軽く）
    const board = boardRef.current;
    const st = board ? board.scrollTop : 0;
    const bh = board ? board.clientHeight : 9999;
    const firstR = Math.floor(st / H) - 3, lastR = Math.ceil((st + bh) / H) + 3;
    vals.forEach((o, rank) => {
      const i = o.i;
      if (rankNum.current[i] !== rank) {
        const prev = rankNum.current[i];
        rankNum.current[i] = rank;
        const row = rowRefs.current[i]; if (row) row.style.transform = `translateY(${rank * H}px)`;
        const rk = rankRefs.current[i]; if (rk) rk.style.color = rank < 3 ? MED[rank] : (cities[i].id === selfId ? "#ffe08a" : "#8b93bd");
        // 追い抜き（順位が上がった）瞬間に一瞬光らせる
        if (prev >= 0 && rank < prev) { const bar = barRefs.current[i]; if (bar) { bar.style.filter = "brightness(1.7)"; window.clearTimeout(flashTimers.current[i]); flashTimers.current[i] = window.setTimeout(() => { const b = barRefs.current[i]; if (b) b.style.filter = "none"; }, 320); } }
      }
      if (rank >= firstR && rank <= lastR) {
        const bar = barRefs.current[i]; if (bar) bar.style.width = Math.max(3, (o.v / maxV) * 100) + "%";
        const vl = valRefs.current[i]; if (vl) vl.textContent = Math.round(o.v).toLocaleString();
        const rk = rankRefs.current[i]; if (rk) rk.textContent = String(rank + 1);
      }
      if (i === selfIdx) selfRankRef.current = rank;
    });
    if (clockRef.current) clockRef.current.textContent = new Date(t).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
    if (selfChipRef.current && selfIdx >= 0) selfChipRef.current.textContent = "自分 " + (selfRankRef.current + 1) + "位";
    const s = scrubRef.current; if (s && document.activeElement !== s) s.value = String(Math.round(pRef.current * 1000));
  }

  const toggle = () => { if (pRef.current >= 1) pRef.current = 0; lastRef.current = null; setPlaying((v) => !v); };
  const restart = () => { pRef.current = 0; lastRef.current = null; setPlaying(true); };
  const cycleSpeed = () => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1));
  const scrollToSelf = () => { const b = boardRef.current; if (b) b.scrollTo({ top: Math.max(0, selfRankRef.current * rowHRef.current - b.clientHeight / 2 + rowHRef.current / 2), behavior: "smooth" }); };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1400, background: "radial-gradient(1200px 500px at 20% -10%, #2b2f6b 0%, rgba(43,47,107,0) 60%), radial-gradient(900px 500px at 100% 120%, #1a2b56 0%, rgba(26,43,86,0) 55%), linear-gradient(160deg,#0e1120 0%,#141a2e 55%,#0c1020 100%)", color: "#eaeefb", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      {/* 固定ヘッダー */}
      <div style={{ flexShrink: 0, padding: "14px 16px 10px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 900, background: "linear-gradient(90deg,#c7cbff,#8a8dff)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>総力の推移</div>
          <div style={{ fontSize: 10.5, color: "#8b93bd", fontWeight: 700 }}>REPLAY</div>
          <button onClick={onClose} aria-label="閉じる" style={{ marginLeft: "auto", width: 32, height: 32, borderRadius: 16, border: "none", background: "rgba(255,255,255,.1)", color: "#cfd4ff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="close" size={15} /></button>
        </div>
        {hasRange && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            {selfIdx >= 0 && <button ref={selfChipRef} onClick={scrollToSelf} style={{ fontSize: 11, fontWeight: 900, color: "#0e1120", background: "#ffe08a", padding: "5px 11px", borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0 }}>自分 —位</button>}
            <div ref={clockRef} style={{ marginLeft: "auto", fontSize: 20, fontWeight: 900, fontVariantNumeric: "tabular-nums", textShadow: "0 2px 10px rgba(120,130,255,.4)" }}>—</div>
          </div>
        )}
      </div>

      {!hasRange ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9aa3c9", fontSize: 14, textAlign: "center", lineHeight: 1.7, padding: 20 }}>推移データがまだ足りません。<br />総力の記録が2回分以上たまると再生できます。</div>
      ) : (
        <>
          {/* スクロールする盤面（全員） */}
          <div ref={boardRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", position: "relative", padding: "6px 14px 6px" }}>
            <div style={{ position: "relative", height: cities.length * rowH }}>
              {cities.map((c, i) => (
                <div key={c.id} ref={(el) => { rowRefs.current[i] = el; }} style={{ position: "absolute", left: 0, right: 0, height: rowH, display: "flex", alignItems: "center", gap: 7, transition: "transform .5s cubic-bezier(.34,1.06,.42,1)", willChange: "transform" }}>
                  <span ref={(el) => { rankRefs.current[i] = el; }} style={{ width: 22, textAlign: "right", fontSize: 10, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "#8b93bd", flexShrink: 0 }} />
                  <span style={{ width: 50, flexShrink: 0, fontSize: 10.5, fontWeight: c.id === selfId ? 900 : 700, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: c.id === selfId ? "#ffe08a" : "#c7ceeb" }}>{c.name}</span>
                  <div style={{ flex: 1, position: "relative", height: Math.min(rowH - 6, 14) }}>
                    <div ref={(el) => { barRefs.current[i] = el; }} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 0, borderRadius: 4, background: `linear-gradient(90deg, ${colors[i]}, ${colors[i]})`, outline: c.id === selfId ? "1.5px solid #ffe08a" : "none", outlineOffset: 1, boxShadow: "inset 0 1px 0 rgba(255,255,255,.18)", transition: "width .18s linear, filter .3s ease" }} />
                  </div>
                  <span ref={(el) => { valRefs.current[i] = el; }} style={{ width: 84, flexShrink: 0, fontSize: 10, fontWeight: 800, color: c.id === selfId ? "#ffe08a" : "#dfe4ff", fontVariantNumeric: "tabular-nums", textAlign: "right" }} />
                </div>
              ))}
            </div>
          </div>

          {/* 固定フッター */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "10px 16px 14px", borderTop: "1px solid rgba(255,255,255,.1)", background: "rgba(10,12,25,.5)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
            <button onClick={toggle} aria-label={playing ? "一時停止" : "再生"} style={{ ...ctrlBtn, width: 46, height: 46, background: "linear-gradient(135deg,#6a6cff,#4b3fc4)", border: "none", boxShadow: "0 6px 18px rgba(75,63,196,.5)" }}>{playing ? "❚❚" : "▶"}</button>
            <button onClick={restart} aria-label="最初から" style={ctrlBtn}>↺</button>
            <input ref={scrubRef} className="snwrace-scrub" type="range" min={0} max={1000} defaultValue={0} onChange={(e) => { pRef.current = Number(e.target.value) / 1000; lastRef.current = null; setPlaying(false); }} style={scrubStyle} />
            <button onClick={cycleSpeed} style={pillBtn}>{speed}x</button>
          </div>
        </>
      )}
      <style>{".snwrace-scrub::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.4);cursor:pointer}"}</style>
    </div>,
    document.body
  );
}

const ctrlBtn: CSSProperties = { width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,.18)", cursor: "pointer", background: "rgba(255,255,255,.08)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 };
const pillBtn: CSSProperties = { border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.08)", color: "#dfe4ff", fontWeight: 800, fontSize: 12, borderRadius: 999, padding: "8px 12px", cursor: "pointer", minWidth: 46, flexShrink: 0 };
const scrubStyle: CSSProperties = { flex: 1, appearance: "none", WebkitAppearance: "none", height: 6, borderRadius: 999, background: "rgba(255,255,255,.16)", outline: "none" };
