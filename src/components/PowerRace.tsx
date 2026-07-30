import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

export interface RaceCity { id: number; name: string; points: { t: number; v: number }[]; }

const RH = 34;      // 上位モードの行高
const CHROME = 236; // ヘッダー＋自分ピン＋操作＋余白のおおよその高さ
const DUR = 17000;  // 全区間の再生時間(ms) @1x

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

export default function PowerRace({ cities, selfId, fmtY, onClose }: {
  cities: RaceCity[];
  selfId: number | null;
  fmtY: (n: number) => string;
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

  const [mode, setMode] = useState<"top" | "all">("top");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [layout, setLayout] = useState<{ rowH: number; visN: number }>({ rowH: RH, visN: Math.min(10, cities.length) });

  const pRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const rowHRef = useRef(RH);
  const visNRef = useRef(Math.min(10, cities.length));
  const lastRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const barRefs = useRef<Array<HTMLDivElement | null>>([]);
  const valRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const rankRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const rankNum = useRef<number[]>(cities.map(() => -1));
  const clockRef = useRef<HTMLDivElement | null>(null);
  const scrubRef = useRef<HTMLInputElement | null>(null);
  const pinRankRef = useRef<HTMLSpanElement | null>(null);
  const pinBarRef = useRef<HTMLDivElement | null>(null);
  const pinValRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  // レイアウト（画面高さに応じて本数/行高を自動調整）
  useEffect(() => {
    const calc = () => {
      const avail = Math.max(180, window.innerHeight - CHROME);
      let rowH = RH, visN = cities.length;
      if (mode === "top") { visN = Math.max(5, Math.min(cities.length, Math.floor(avail / RH))); rowH = RH; }
      else { visN = cities.length; rowH = Math.max(14, Math.min(RH, Math.floor(avail / Math.max(1, cities.length)))); }
      rowHRef.current = rowH; visNRef.current = visN;
      setLayout({ rowH, visN });
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [mode, cities.length]);
  // レイアウト変更時は全行を再配置（順位が変わらなくても行高が変わるため）
  useEffect(() => { rankNum.current = cities.map(() => -1); }, [layout, cities]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
    const rowH = rowHRef.current, visN = visNRef.current, compact = rowH < 22;
    const t = minT + pRef.current * (maxT - minT);
    const vals = cities.map((c, i) => ({ i, v: interp(c.points, t) }));
    vals.sort((a, b) => b.v - a.v);
    const maxV = vals[0]?.v || 1;
    vals.forEach((o, rank) => {
      const i = o.i, visible = rank < visN;
      if (rankNum.current[i] !== rank) {
        rankNum.current[i] = rank;
        const row = rowRefs.current[i];
        if (row) { row.style.transform = `translateY(${(visible ? rank : visN) * rowH}px)`; row.style.opacity = visible ? "1" : "0"; }
        const rk = rankRefs.current[i];
        if (rk) rk.style.color = rank < 3 ? MED[rank] : (cities[i].id === selfId ? "#ffe08a" : "#aeb6e6");
      }
      if (visible) {
        const bar = barRefs.current[i]; if (bar) bar.style.width = Math.max(4, (o.v / maxV) * 100) + "%";
        const vl = valRefs.current[i]; if (vl) vl.textContent = compact ? "" : fmtY(o.v);
        const rk = rankRefs.current[i]; if (rk) rk.textContent = String(rank + 1);
      }
    });
    if (selfIdx >= 0) {
      const selfRank = vals.findIndex((o) => o.i === selfIdx);
      const sv = vals[selfRank].v;
      if (pinRankRef.current) pinRankRef.current.textContent = selfRank + 1 + "位";
      if (pinBarRef.current) pinBarRef.current.style.width = Math.max(4, (sv / maxV) * 100) + "%";
      if (pinValRef.current) pinValRef.current.textContent = fmtY(sv);
    }
    if (clockRef.current) clockRef.current.textContent = new Date(t).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
    const s = scrubRef.current; if (s && document.activeElement !== s) s.value = String(Math.round(pRef.current * 1000));
  }

  const toggle = () => { if (pRef.current >= 1) pRef.current = 0; lastRef.current = null; setPlaying((v) => !v); };
  const restart = () => { pRef.current = 0; lastRef.current = null; setPlaying(true); };
  const cycleSpeed = () => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1));
  const boardH = layout.visN * layout.rowH;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1400, background: "radial-gradient(1200px 500px at 20% -10%, #2b2f6b 0%, rgba(43,47,107,0) 60%), radial-gradient(900px 500px at 100% 120%, #1a2b56 0%, rgba(26,43,86,0) 55%), linear-gradient(160deg,#0e1120 0%,#141a2e 55%,#0c1020 100%)", color: "#eaeefb", display: "flex", flexDirection: "column", padding: "16px 16px 16px", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 900, background: "linear-gradient(90deg,#c7cbff,#8a8dff)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>総力の推移</div>
          <div style={{ fontSize: 11, color: "#9aa3c9", fontWeight: 600, marginTop: 2 }}>POWER RANKING REPLAY</div>
        </div>
        <div ref={clockRef} style={{ marginLeft: "auto", fontSize: 22, fontWeight: 900, fontVariantNumeric: "tabular-nums", textShadow: "0 2px 10px rgba(120,130,255,.4)" }}>—</div>
        <button onClick={onClose} aria-label="閉じる" style={{ width: 34, height: 34, borderRadius: 17, border: "none", background: "rgba(255,255,255,.1)", color: "#cfd4ff", cursor: "pointer", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={16} /></button>
      </div>

      {!hasRange ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9aa3c9", fontSize: 14, textAlign: "center", lineHeight: 1.7, padding: 20 }}>推移データがまだ足りません。<br />総力の記録が2回分以上たまると再生できます。</div>
      ) : (
        <>
          <div style={{ position: "relative", overflow: "hidden", marginTop: 14, height: boardH, flexShrink: 0 }}>
            {cities.map((c, i) => (
              <div key={c.id} ref={(el) => { rowRefs.current[i] = el; }} style={{ position: "absolute", left: 0, right: 0, height: layout.rowH, display: "flex", alignItems: "center", gap: 8, opacity: 0, transition: "transform .55s cubic-bezier(.34,1.06,.42,1), opacity .4s ease", willChange: "transform, opacity" }}>
                <span ref={(el) => { rankRefs.current[i] = el; }} style={{ width: 24, textAlign: "right", fontSize: 12, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: "#aeb6e6", flexShrink: 0 }} />
                <span style={{ width: layout.rowH < 22 ? 58 : 76, flexShrink: 0, fontSize: layout.rowH < 22 ? 10.5 : 12.5, fontWeight: c.id === selfId ? 900 : 800, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: c.id === selfId ? "#ffe08a" : "#dfe4ff" }}>{c.name}</span>
                <div style={{ flex: 1, position: "relative", height: Math.min(layout.rowH - 6, 22) }}>
                  <div ref={(el) => { barRefs.current[i] = el; }} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 0, borderRadius: 6, background: `linear-gradient(90deg, ${colors[i]}, ${colors[i]})`, outline: c.id === selfId ? "1.5px solid #ffe08a" : "none", outlineOffset: 1, boxShadow: "inset 0 1px 0 rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 7, transition: "width .18s linear" }}>
                    <span ref={(el) => { valRefs.current[i] = el; }} style={{ fontSize: layout.rowH < 22 ? 10 : 11.5, fontWeight: 900, color: "#fff", whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(0,0,0,.35)" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {mode === "top" && selfIdx >= 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px dashed rgba(255,255,255,.14)", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: "#0e1120", background: "#ffe08a", padding: "3px 8px", borderRadius: 999, flexShrink: 0 }}>自分</span>
              <span ref={pinRankRef} style={{ width: 40, textAlign: "center", fontSize: 15, fontWeight: 900, color: "#ffe08a", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>—</span>
              <span style={{ width: 76, flexShrink: 0, fontSize: 12.5, fontWeight: 800, color: "#ffe08a", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cities[selfIdx].name}</span>
              <div style={{ flex: 1, position: "relative", height: 22 }}>
                <div ref={pinBarRef} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 0, borderRadius: 6, background: "linear-gradient(90deg,#c99b2e,#ffe08a)", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 7, transition: "width .18s linear" }}>
                  <span ref={pinValRef} style={{ fontSize: 11, fontWeight: 900, color: "#3a2c00", whiteSpace: "nowrap" }} />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto", paddingTop: 14, flexShrink: 0 }}>
            <button onClick={toggle} aria-label={playing ? "一時停止" : "再生"} style={{ ...ctrlBtn, width: 48, height: 48, background: "linear-gradient(135deg,#6a6cff,#4b3fc4)", border: "none", boxShadow: "0 6px 18px rgba(75,63,196,.5)" }}>{playing ? "❚❚" : "▶"}</button>
            <button onClick={restart} aria-label="最初から" style={ctrlBtn}>↺</button>
            <input ref={scrubRef} className="snwrace-scrub" type="range" min={0} max={1000} defaultValue={0} onChange={(e) => { pRef.current = Number(e.target.value) / 1000; lastRef.current = null; setPlaying(false); }} style={scrubStyle} />
            <button onClick={cycleSpeed} style={pillBtn}>{speed}x</button>
            <button onClick={() => setMode((m) => (m === "top" ? "all" : "top"))} style={pillBtn}>{mode === "top" ? "全員" : "上位"}</button>
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
