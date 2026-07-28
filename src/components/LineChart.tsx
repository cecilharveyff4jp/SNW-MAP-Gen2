import { useRef, useState } from "react";

// 依存なしの軽量SVG折れ線グラフ。points=[{t:ミリ秒, v:値}]。
// グラフのどこを触っても一番近い記録を選択、指を左右に滑らせて記録間を移動（スクラブ）。
export default function LineChart({ points, color = "var(--accent, #5b5bd6)", fmtY = (n: number) => String(n), fmtX }: {
  points: { t: number; v: number }[];
  color?: string;
  fmtY?: (n: number) => string;
  fmtX?: (t: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pts = [...points].filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v)).sort((a, b) => a.t - b.t);
  if (pts.length === 0) return <div style={{ fontSize: 13, color: "#adb5bd", padding: "18px 0", textAlign: "center" }}>まだ履歴がありません。</div>;

  const W = 320, H = 148, padL = 6, padR = 6, padT = 10, padB = 16;
  const iw = W - padL - padR, ih = H - padT - padB;
  const xs = pts.map((p) => p.t), ys = pts.map((p) => p.v);
  const minT = Math.min(...xs), maxT = Math.max(...xs);
  let minV = Math.min(...ys), maxV = Math.max(...ys);
  if (minV === maxV) { const pad = Math.max(1, Math.abs(minV) * 0.05); minV -= pad; maxV += pad; }
  const sx = (t: number) => padL + (maxT === minT ? 0.5 : (t - minT) / (maxT - minT)) * iw;
  const sy = (v: number) => padT + ih - ((v - minV) / (maxV - minV)) * ih;
  const line = pts.map((p, i) => (i ? "L" : "M") + sx(p.t).toFixed(1) + " " + sy(p.v).toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  const area = "M" + sx(pts[0].t).toFixed(1) + " " + (padT + ih).toFixed(1) + " " + pts.map((p) => "L" + sx(p.t).toFixed(1) + " " + sy(p.v).toFixed(1)).join(" ") + " L" + sx(last.t).toFixed(1) + " " + (padT + ih).toFixed(1) + " Z";
  const gy = [maxV, (minV + maxV) / 2, minV];
  const dt = (t: number) => { const d = new Date(t); return (d.getMonth() + 1) + "/" + d.getDate(); };
  const fx = fmtX ?? ((t: number) => new Date(t).toLocaleDateString("ja-JP"));

  const pick = (clientX: number) => {
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect(); if (!rect.width) return;
    const x = ((clientX - rect.left) / rect.width) * W;
    let best = 0, bd = Infinity;
    for (let i = 0; i < pts.length; i++) { const d = Math.abs(sx(pts[i].t) - x); if (d < bd) { bd = d; best = i; } }
    setActive(best);
  };

  return (
    <svg ref={svgRef} viewBox={"0 0 " + W + " " + H} width="100%" style={{ height: "auto", display: "block", overflow: "visible", touchAction: "pan-y" }} role="img">
      {gy.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={sy(v)} y2={sy(v)} stroke="#eef1f5" strokeWidth={1} />
          <text x={W - padR} y={sy(v) - 2} textAnchor="end" fontSize={8} fill="#adb5bd">{fmtY(Math.round(v))}</text>
        </g>
      ))}
      <path d={area} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (<circle key={"d" + i} cx={sx(p.t)} cy={sy(p.v)} r={active === i ? 3 : 2.4} fill={color} />))}
      {active == null && <circle cx={sx(last.t)} cy={sy(last.v)} r={3.4} fill={color} stroke="#fff" strokeWidth={1.5} />}
      <text x={padL} y={H - 3} fontSize={8} fill="#adb5bd">{dt(minT)}</text>
      <text x={W - padR} y={H - 3} textAnchor="end" fontSize={8} fill="#adb5bd">{dt(maxT)}</text>

      {active != null && active < pts.length && (
        <line x1={sx(pts[active].t)} x2={sx(pts[active].t)} y1={padT} y2={padT + ih} stroke={color} strokeWidth={1} opacity={0.3} pointerEvents="none" />
      )}

      <rect x={0} y={0} width={W} height={H} fill="transparent" style={{ cursor: "pointer", touchAction: "pan-y" }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); pick(e.clientX); }}
        onPointerMove={(e) => pick(e.clientX)}
        onMouseLeave={() => setActive(null)} />

      {active != null && active < pts.length && (() => {
        const p = pts[active]; const px = sx(p.t), py = sy(p.v);
        const dnum = active > 0 ? p.v - pts[active - 1].v : null;
        const l1 = fx(p.t), l2 = p.v.toLocaleString();
        const l3 = dnum == null ? "前回なし" : dnum > 0 ? "▲ +" + dnum.toLocaleString() : dnum < 0 ? "▼ -" + Math.abs(dnum).toLocaleString() : "±0";
        const l3col = dnum == null ? "#9aa6b6" : dnum > 0 ? "#51cf66" : dnum < 0 ? "#ff8787" : "#c7d0dc";
        const tw = Math.max(l1.length, l2.length, l3.length) * 5.4 + 16;
        const th = 37;
        let bx = px - tw / 2; if (bx < 2) bx = 2; if (bx + tw > W - 2) bx = W - 2 - tw;
        let by = py - th - 7; if (by < 2) by = py + 10;
        return (
          <g pointerEvents="none">
            <circle cx={px} cy={py} r={4.2} fill="#fff" stroke={color} strokeWidth={2.4} />
            <rect x={bx} y={by} width={tw} height={th} rx={5} fill="rgba(27,35,54,0.94)" />
            <text x={bx + tw / 2} y={by + 10} textAnchor="middle" fontSize={8} fill="#c7d0dc">{l1}</text>
            <text x={bx + tw / 2} y={by + 20.5} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#fff" fontFamily="system-ui">{l2}</text>
            <text x={bx + tw / 2} y={by + 31} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={l3col}>{l3}</text>
          </g>
        );
      })()}
    </svg>
  );
}
