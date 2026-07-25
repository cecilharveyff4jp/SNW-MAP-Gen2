import { useState } from "react";

// 依存なしの軽量SVG折れ線グラフ。points=[{t:ミリ秒, v:値}]。点をタップ/ホバーで日時＋値をツールチップ表示。
export default function LineChart({ points, color = "var(--accent, #5b5bd6)", fmtY = (n: number) => String(n), fmtX }: {
  points: { t: number; v: number }[];
  color?: string;
  fmtY?: (n: number) => string;
  fmtX?: (t: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
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
  const fx = fmtX ?? ((t: number) => new Date(t).toLocaleDateString("ja-JP"));

  return (
    <svg viewBox={"0 0 " + W + " " + H} width="100%" style={{ height: "auto", display: "block", overflow: "visible" }} role="img">
      <rect x={0} y={0} width={W} height={H} fill="transparent" onPointerDown={() => setActive(null)} />
      {gy.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={sy(v)} y2={sy(v)} stroke="#eef1f5" strokeWidth={1} />
          <text x={W - padR} y={sy(v) - 2} textAnchor="end" fontSize={8} fill="#adb5bd">{fmtY(Math.round(v))}</text>
        </g>
      ))}
      <path d={area} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (<circle key={"d" + i} cx={sx(p.t)} cy={sy(p.v)} r={2.3} fill={color} />))}
      <circle cx={sx(last.t)} cy={sy(last.v)} r={3.4} fill={color} stroke="#fff" strokeWidth={1.5} />
      <text x={padL} y={H - 3} fontSize={8} fill="#adb5bd">{dt(minT)}</text>
      <text x={W - padR} y={H - 3} textAnchor="end" fontSize={8} fill="#adb5bd">{dt(maxT)}</text>
      {/* タップ/ホバー用の広いヒット領域 */}
      {pts.map((p, i) => (<circle key={"h" + i} cx={sx(p.t)} cy={sy(p.v)} r={11} fill="transparent" style={{ cursor: "pointer" }} onPointerDown={(e) => { e.stopPropagation(); setActive(i); }} onMouseEnter={() => setActive(i)} />))}
      {active != null && active < pts.length && (() => {
        const p = pts[active]; const px = sx(p.t), py = sy(p.v);
        const l1 = fx(p.t), l2 = p.v.toLocaleString();
        const tw = Math.max(l1.length, l2.length) * 5.4 + 14;
        let bx = px - tw / 2; if (bx < 2) bx = 2; if (bx + tw > W - 2) bx = W - 2 - tw;
        let by = py - 34; if (by < 2) by = py + 8;
        return (
          <g pointerEvents="none">
            <circle cx={px} cy={py} r={3.6} fill="#fff" stroke={color} strokeWidth={2} />
            <rect x={bx} y={by} width={tw} height={26} rx={5} fill="rgba(27,35,54,0.94)" />
            <text x={bx + tw / 2} y={by + 10.5} textAnchor="middle" fontSize={8} fill="#c7d0dc">{l1}</text>
            <text x={bx + tw / 2} y={by + 20} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#fff" fontFamily="system-ui">{l2}</text>
          </g>
        );
      })()}
    </svg>
  );
}
