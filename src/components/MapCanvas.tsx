import { useEffect, useRef } from "react";
import type { MapObject, ObjectType } from "../lib/types";
import { project, footprintCorners, footprintCenter, anchorCenter } from "../lib/iso";
import { rangeOf, fcDisplay } from "../lib/sizes";

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

const GRID_MARGIN = 2; // タイル単位の余白

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
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";

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

      // タイル範囲（オブジェクト＋余白）を求めてグリッドと描画範囲を決める
      const minTX = Math.min(...objects.map((o) => o.anchorX - rangeOf(o.type))) - GRID_MARGIN;
      const maxTX = Math.max(...objects.map((o) => o.anchorX + o.w + rangeOf(o.type))) + GRID_MARGIN;
      const minTY = Math.min(...objects.map((o) => o.anchorY - rangeOf(o.type))) - GRID_MARGIN;
      const maxTY = Math.max(...objects.map((o) => o.anchorY + o.h + rangeOf(o.type))) + GRID_MARGIN;

      const gridCorners = [
        project(minTX, minTY),
        project(maxTX, minTY),
        project(maxTX, maxTY),
        project(minTX, maxTY),
      ];
      const minX = Math.min(...gridCorners.map((p) => p.x));
      const maxX = Math.max(...gridCorners.map((p) => p.x));
      const minY = Math.min(...gridCorners.map((p) => p.y));
      const maxY = Math.max(...gridCorners.map((p) => p.y));

      const pad = 24;
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

      // 背景：1×1 タイルのグリッド線
      ctx.strokeStyle = "#e9ecef";
      ctx.lineWidth = 1;
      for (let gx = minTX; gx <= maxTX; gx++) {
        const a = project(gx, minTY);
        const b = project(gx, maxTY);
        ctx.beginPath();
        ctx.moveTo(tx(a.x), ty(a.y));
        ctx.lineTo(tx(b.x), ty(b.y));
        ctx.stroke();
      }
      for (let gy = minTY; gy <= maxTY; gy++) {
        const a = project(minTX, gy);
        const b = project(maxTX, gy);
        ctx.beginPath();
        ctx.moveTo(tx(a.x), ty(a.y));
        ctx.lineTo(tx(b.x), ty(b.y));
        ctx.stroke();
      }

      // 占領範囲レイヤー（HQ/旗/像）— チェビシェフ距離の正方形
      for (const o of objects) {
        const r = rangeOf(o.type);
        if (!r) continue;
        const rc = [
          project(o.anchorX - r, o.anchorY - r),
          project(o.anchorX + o.w + r, o.anchorY - r),
          project(o.anchorX + o.w + r, o.anchorY + o.h + r),
          project(o.anchorX - r, o.anchorY + o.h + r),
        ];
        ctx.beginPath();
        rc.forEach((p, i) => {
          const x = tx(p.x);
          const y = ty(p.y);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = "rgba(64,160,255,0.10)";
        ctx.fill();
        ctx.strokeStyle = "rgba(64,160,255,0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // オブジェクト：奥（画面上）から手前（画面下）へ
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
        ctx.fillStyle = color + "59";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.stroke();

        const ac = anchorCenter(o);
        ctx.fillStyle = "#212529";
        ctx.font = "13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("★", tx(ac.x), ty(ac.y));

        const c = footprintCenter(o);
        const title = (o.label || o.type) + (o.fcLevel ? " " + fcDisplay(o.fcLevel) : "");
        const sub = o.memberName
          ? o.memberName
          : "(" + o.anchorX + "," + o.anchorY + ")";
        ctx.fillStyle = "#212529";
        ctx.font = "600 12px system-ui, sans-serif";
        ctx.fillText(title, tx(c.x), ty(c.y) - 7);
        ctx.fillStyle = "#495057";
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillText(sub, tx(c.x), ty(c.y) + 7);
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
