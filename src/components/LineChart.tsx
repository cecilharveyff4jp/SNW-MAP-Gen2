// 依存なしの軽量SVG折れ線グラフ。points=[{t:ミリ秒, v:値}]。
export default function LineChart({ points, color = "var(--accent, #5b5bd6)", fmtY = (n: number) => String(n) }: {
  points: { t: number; v: number }[];
  color?: string;
  fmtY?: (n: number) => string;
}) {
  const pts = [...points].filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v)).sort((a, b) => a.t - b.t);
  if (pts.length === 0) return <div style={{ fontSize: 13, color: "#adb5bd", padding: "18px 0", textAlign: "center" }}>まだ履歴がありません。</div>;

  const W = 320, H = 140, padL = 6, padR = 6, padT = 10, padB = 16;
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

  return (
    <svg viewBox={"0 0 " + W + " " + H} width="100%" style={{ height: "auto", display: "block", overflow: "visible" }} role="img">
      {gy.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={sy(v)} y2={sy(v)} stroke="#eef1f5" strokeWidth={1} />
          <text x={W - padR} y={sy(v) - 2} textAnchor="end" fontSize={8} fill="#adb5bd">{fmtY(Math.round(v))}</text>
        </g>
      ))}
      <path d={area} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (<circle key={i} cx={sx(p.t)} cy={sy(p.v)} r={2.3} fill={color} />))}
      <circle cx={sx(last.t)} cy={sy(last.v)} r={3.4} fill={color} stroke="#fff" strokeWidth={1.5} />
      <text x={padL} y={H - 3} fontSize={8} fill="#adb5bd">{dt(minT)}</text>
      <text x={W - padR} y={H - 3} textAnchor="end" fontSize={8} fill="#adb5bd">{dt(maxT)}</text>
    </svg>
  );
}
