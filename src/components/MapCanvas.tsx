import { useEffect, useRef } from "react";
import type { MapObject, ObjectType } from "../lib/types";
import { footprintCorners, footprintCenter, anchorCenter } from "../lib/iso";

const TYPE_COLORS: Record<ObjectType, string> = {
  HQ: "#e8590c",
  CITY: "#1c7ed6",
  STATUE: "#ae3ec9",
  DEPOT: "#f08c00",
  BEAR_TRAP: "#e03131",
  MOUNTAIN: "#2f9e44",
  LAKE: "#1098ad",
  FLAG: "#495057",
};

interface Props {
  objects: MapObject[];
  height?: number;
}

export default function MapCanvas({ objects, height = 520 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const draw = () => {
      const cssW = wrap.clientWidth;
      const cssH = height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      if (objects.length === 0) {
        ctx.fillStyle = "#868e96";
        ctx.font = "14px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("オブジェクトがありません", cssW / 2, cssH / 2);
        return;
      }

      // 全オブジェクトの投影座標から bounding box を求めてフィット
      const all = objects.flatMap(footprintCorners);
      const minX = Math.min(...all.map((p) => p.x));
      const maxX = Math.max(...all.map((p) => p.x));
      const minY = Math.min(...all.map((p) => p.y));
      const maxY = Math.max(...all.map((p) => p.y));
      const pad = 48;
      const contentW = Math.max(maxX - minX, 1);
      const contentH = Math.max(maxY - minY, 1);
      const scale = Math.min(
        (cssW - pad * 2) / contentW,
        (cssH - pad * 2) / contentH,
        2.0
      );
      const offX = (cssW - contentW * scale) / 2 - minX * scale;
      const offY = (cssH - contentH * scale) / 2 - minY * scale;
      const tx = (x: number) => x * scale + offX;
      const ty = (y: number) => y * scale + offY;

      // 奥（画面上）から手前（画面下）へ描画
      const ordered = [...objects].sort(
        (a, b) => footprintCenter(a).y - footprintCenter(b).y
      );

      for (const o of ordered) {
        const corners = footprintCorners(o);
        ctx.beginPath();
        corners.forEach((p, i) => {
          const x = tx(p.x);
          const y = ty(p.y);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        const color = TYPE_COLORS[o.type] ?? "#868e96";
        ctx.fillStyle = color + "59"; // ~35% alpha
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.stroke();

        // アンカー ★
        const ac = anchorCenter(o);
        ctx.fillStyle = "#212529";
        ctx.font = "13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("★", tx(ac.x), ty(ac.y));

        // ラベル
        const c = footprintCenter(o);
        ctx.fillStyle = "#212529";
        ctx.font = "600 12px system-ui, sans-serif";
        const name = o.label || o.type;
        ctx.fillText(name, tx(c.x), ty(c.y) - 7);
        ctx.fillStyle = "#495057";
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillText(
          `(${o.anchorX},${o.anchorY}) ${o.w}×${o.h}`,
          tx(c.x),
          ty(c.y) + 7
        );
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [objects, height]);

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          background: "#f8f9fa",
          borderRadius: 8,
          border: "1px solid #dee2e6",
        }}
      />
    </div>
  );
}
