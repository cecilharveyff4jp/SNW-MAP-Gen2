import { useRef, useState } from "react";

// SVGは自動折返しをしないので、ツールチップ幅は文字幅を概算して決める（全角はほぼ字高ぶん、半角はその約55%）。
const twOf = (s: string, size: number) => { let w = 0; for (const ch of s) w += ch.charCodeAt(0) > 0x2e7f ? size * 0.98 : size * 0.55; return w; };
const dcol = (n: number) => (n > 0 ? "#51cf66" : n < 0 ? "#ff8787" : "#c7d0dc");

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
        const isLast = active === pts.length - 1;
        const dPrev = active > 0 ? p.v - pts[active - 1].v : null;
        const dLast = last.v - p.v; // 最終計測値 − ピン。ここから先どれだけ伸びたか。
        const l1 = fx(p.t), l2 = p.v.toLocaleString();
        const r3v = dPrev == null ? "なし" : dPrev > 0 ? "▲ +" + dPrev.toLocaleString() : dPrev < 0 ? "▼ -" + Math.abs(dPrev).toLocaleString() : "±0";
        const r3c = dPrev == null ? "#9aa6b6" : dcol(dPrev);
        const r4v = dLast > 0 ? "+" + dLast.toLocaleString() : dLast < 0 ? "-" + Math.abs(dLast).toLocaleString() : "±0";
        const foot = isLast ? "これが最新の記録" : null;

        const PAD = 9, GAP = 10;
        const rowW = (l: string, v: string) => twOf(l, 8) + GAP + twOf(v, 8.5);
        const tw = Math.max(twOf(l1, 8), twOf(l2, 9.5), rowW("前回比", r3v), foot ? twOf(foot, 8.5) : rowW("最新まで", r4v)) + PAD * 2;
        const th = 48;
        let bx = px - tw / 2; if (bx < 2) bx = 2; if (bx + tw > W - 2) bx = W - 2 - tw;
        let by = py - th - 7; if (by < 2) by = py + 10; if (by + th > H - 2) by = Math.max(2, py - th - 7);
        return (
          <g pointerEvents="none">
            <circle cx={px} cy={py} r={4.2} fill="#fff" stroke={color} strokeWidth={2.4} />
            <rect x={bx} y={by} width={tw} height={th} rx={5} fill="rgba(27,35,54,0.94)" />
            <text x={bx + tw / 2} y={by + 11} textAnchor="middle" fontSize={8} fill="#c7d0dc">{l1}</text>
            <text x={bx + tw / 2} y={by + 23} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#fff" fontFamily="system-ui">{l2}</text>
            <line x1={bx + PAD} x2={bx + tw - PAD} y1={by + 27.5} y2={by + 27.5} stroke="rgba(255,255,255,0.14)" strokeWidth={1} />
            <text x={bx + PAD} y={by + 37} fontSize={8} fill="#9aa6b6">前回比</text>
            <text x={bx + tw - PAD} y={by + 37} textAnchor="end" fontSize={8.5} fontWeight={700} fill={r3c}>{r3v}</text>
            {foot ? (
              <text x={bx + tw / 2} y={by + 44.5} textAnchor="middle" fontSize={8} fill="#9aa6b6">{foot}</text>
            ) : (
              <>
                <text x={bx + PAD} y={by + 44.5} fontSize={8} fill="#9aa6b6">最新まで</text>
                <text x={bx + tw - PAD} y={by + 44.5} textAnchor="end" fontSize={8.5} fontWeight={700} fill={dcol(dLast)}>{r4v}</text>
              </>
            )}
          </g>
        );
      })()}
    </svg>
  );
}
