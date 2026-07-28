import { useRef, useState } from "react";

type Pt = { t: number; v: number };
type Series = { name: string; color: string; points: Pt[] };

// 2人の総力推移を1枚に重ねる比較グラフ。どこを触っても一番近い記録を選択、指を左右に滑らせて移動。
export default function CompareChart({ a, b, fmtY = (n: number) => String(n), fmtX }: { a: Series; b: Series; fmtY?: (n: number) => string; fmtX?: (t: number) => string }) {
  const [active, setActive] = useState<{ s: number; i: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const clean = (p: Pt[]) => [...p].filter((x) => Number.isFinite(x.t) && Number.isFinite(x.v)).sort((m, n) => m.t - n.t);
  const series = [{ ...a, pts: clean(a.points) }, { ...b, pts: clean(b.points) }];
  const all = [...series[0].pts, ...series[1].pts];
  if (all.length === 0) return <div style={{ fontSize: 13, color: "#adb5bd", padding: "18px 0", textAlign: "center" }}>履歴がありません。</div>;

  const W = 320, H = 152, padL = 6, padR = 6, padT = 10, padB = 16;
  const iw = W - padL - padR, ih = H - padT - padB;
  const xs = all.map((p) => p.t), ys = all.map((p) => p.v);
  const minT = Math.min(...xs), maxT = Math.max(...xs);
  let minV = Math.min(...ys), maxV = Math.max(...ys);
  if (minV === maxV) { const pad = Math.max(1, Math.abs(minV) * 0.05); minV -= pad; maxV += pad; }
  const sx = (t: number) => padL + (maxT === minT ? 0.5 : (t - minT) / (maxT - minT)) * iw;
  const sy = (v: number) => padT + ih - ((v - minV) / (maxV - minV)) * ih;
  const pathOf = (pts: Pt[]) => pts.map((p, i) => (i ? "L" : "M") + sx(p.t).toFixed(1) + " " + sy(p.v).toFixed(1)).join(" ");
  const gy = [maxV, (minV + maxV) / 2, minV];
  const fx = fmtX ?? ((t: number) => new Date(t).toLocaleDateString("ja-JP"));
  const dt = (t: number) => { const d = new Date(t); return (d.getMonth() + 1) + "/" + d.getDate(); };

  const pick = (clientX: number, clientY: number) => {
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect(); if (!rect.width) return;
    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;
    let best: { s: number; i: number } | null = null, bd = Infinity;
    series.forEach((s, si) => s.pts.forEach((p, i) => { const dx = sx(p.t) - x, dy = sy(p.v) - y; const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = { s: si, i }; } }));
    if (best) setActive(best);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 4, fontSize: 12 }}>
        {series.map((s, i) => (<span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#495057", fontWeight: 600, minWidth: 0 }}><span style={{ width: 12, height: 3, borderRadius: 2, background: s.color, flexShrink: 0 }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>{s.name}</span></span>))}
      </div>
      <svg ref={svgRef} viewBox={"0 0 " + W + " " + H} width="100%" style={{ height: "auto", display: "block", overflow: "visible", touchAction: "pan-y" }} role="img">
        {gy.map((v, i) => (<g key={i}><line x1={padL} x2={W - padR} y1={sy(v)} y2={sy(v)} stroke="#eef1f5" strokeWidth={1} /><text x={W - padR} y={sy(v) - 2} textAnchor="end" fontSize={8} fill="#adb5bd">{fmtY(Math.round(v))}</text></g>))}
        {series.map((s, si) => (<g key={si}><path d={pathOf(s.pts)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />{s.pts.map((p, i) => (<circle key={i} cx={sx(p.t)} cy={sy(p.v)} r={active && active.s === si && active.i === i ? 3 : 2.2} fill={s.color} />))}</g>))}
        <text x={padL} y={H - 3} fontSize={8} fill="#adb5bd">{dt(minT)}</text>
        <text x={W - padR} y={H - 3} textAnchor="end" fontSize={8} fill="#adb5bd">{dt(maxT)}</text>

        {active && (() => { const s = series[active.s]; const p = s.pts[active.i]; if (!p) return null; const px = sx(p.t); return <line x1={px} x2={px} y1={padT} y2={padT + ih} stroke={s.color} strokeWidth={1} opacity={0.3} pointerEvents="none" />; })()}

        <rect x={0} y={0} width={W} height={H} fill="transparent" style={{ cursor: "pointer", touchAction: "pan-y" }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); pick(e.clientX, e.clientY); }}
          onPointerMove={(e) => pick(e.clientX, e.clientY)}
          onMouseLeave={() => setActive(null)} />

        {active && (() => {
          const s = series[active.s]; const p = s.pts[active.i]; if (!p) return null;
          const px = sx(p.t), py = sy(p.v);
          const dnum = active.i > 0 ? p.v - s.pts[active.i - 1].v : null;
          const l1 = fx(p.t), l2 = p.v.toLocaleString(), nm = s.name;
          const l3 = dnum == null ? "前回なし" : dnum > 0 ? "▲ +" + dnum.toLocaleString() : dnum < 0 ? "▼ -" + Math.abs(dnum).toLocaleString() : "±0";
          const l3col = dnum == null ? "#9aa6b6" : dnum > 0 ? "#51cf66" : dnum < 0 ? "#ff8787" : "#c7d0dc";
          const tw = Math.max(nm.length, l1.length, l2.length, l3.length) * 5.4 + 16, th = 48;
          let bx = px - tw / 2; if (bx < 2) bx = 2; if (bx + tw > W - 2) bx = W - 2 - tw;
          let by = py - th - 7; if (by < 2) by = py + 10;
          return (
            <g pointerEvents="none">
              <circle cx={px} cy={py} r={4.2} fill="#fff" stroke={s.color} strokeWidth={2.4} />
              <rect x={bx} y={by} width={tw} height={th} rx={5} fill="rgba(27,35,54,0.94)" />
              <text x={bx + tw / 2} y={by + 10} textAnchor="middle" fontSize={8} fontWeight={700} fill={s.color}>{nm}</text>
              <text x={bx + tw / 2} y={by + 20} textAnchor="middle" fontSize={8} fill="#c7d0dc">{l1}</text>
              <text x={bx + tw / 2} y={by + 30.5} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#fff" fontFamily="system-ui">{l2}</text>
              <text x={bx + tw / 2} y={by + 41} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={l3col}>{l3}</text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
