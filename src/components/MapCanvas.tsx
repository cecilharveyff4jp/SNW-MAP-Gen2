import { useEffect, useRef } from "react";
import type { MapObject, ObjectType } from "../lib/types";
import {
  project,
  footprintCorners,
  footprintCenter,
  TILE_HW,
  TILE_HH,
} from "../lib/iso";
import { rangeOf, fcDisplay } from "../lib/sizes";

// 旧版テーマ色（塗り＝半透明 / 枠＝濃いめ）
const TYPE_STYLE: Record<ObjectType, { fill: string; stroke: string }> = {
  HQ: { fill: "rgba(46,107,255,0.55)", stroke: "#1d4ed8" },
  BEAR_TRAP: { fill: "rgba(255,138,42,0.55)", stroke: "#c2410c" },
  STATUE: { fill: "rgba(33,195,138,0.55)", stroke: "#15803d" },
  CITY: { fill: "rgba(181,107,255,0.45)", stroke: "#7e22ce" },
  DEPOT: { fill: "rgba(180,120,60,0.55)", stroke: "#8B4513" },
  MOUNTAIN: { fill: "rgba(120,113,108,0.55)", stroke: "#57534e" },
  LAKE: { fill: "rgba(96,165,250,0.55)", stroke: "#1e40af" },
  FLAG: { fill: "rgba(244,114,182,0.55)", stroke: "#be185d" },
};

// 種別アイコン（絵文字＝画像資産ゼロ）
const TYPE_ICON: Record<ObjectType, string> = {
  HQ: "🏰",
  CITY: "🏠",
  STATUE: "🗿",
  DEPOT: "📦",
  BEAR_TRAP: "🐻",
  MOUNTAIN: "⛰️",
  LAKE: "💧",
  FLAG: "🚩",
};

// ラベルに背景ピルを付けない種別（白フチ文字）
const NO_BG_LABEL = new Set<ObjectType>(["MOUNTAIN", "LAKE", "FLAG"]);

const GRID_MARGIN = 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface Props {
  objects: MapObject[];
  height?: number;
}

export default function MapCanvas({ objects, height = 520 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fcImagesRef = useRef<Record<string, HTMLImageElement>>({});

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
      const base = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      base();
      ctx.clearRect(0, 0, cssW, cssH);

      if (objects.length === 0) {
        ctx.fillStyle = "#868e96";
        ctx.font = "14px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("オブジェクトがありません", cssW / 2, cssH / 2);
        return;
      }

      // 表示範囲（占領範囲込み）でフィット
      const minTX = Math.min(...objects.map((o) => o.anchorX - rangeOf(o.type))) - GRID_MARGIN;
      const maxTX = Math.max(...objects.map((o) => o.anchorX + o.w + rangeOf(o.type))) + GRID_MARGIN;
      const minTY = Math.min(...objects.map((o) => o.anchorY - rangeOf(o.type))) - GRID_MARGIN;
      const maxTY = Math.max(...objects.map((o) => o.anchorY + o.h + rangeOf(o.type))) + GRID_MARGIN;
      const gc = [project(minTX, minTY), project(maxTX, minTY), project(maxTX, maxTY), project(minTX, maxTY)];
      const minX = Math.min(...gc.map((p) => p.x));
      const maxX = Math.max(...gc.map((p) => p.x));
      const minY = Math.min(...gc.map((p) => p.y));
      const maxY = Math.max(...gc.map((p) => p.y));
      const pad = 28;
      const contentW = Math.max(maxX - minX, 1);
      const contentH = Math.max(maxY - minY, 1);
      const scale = Math.min((cssW - pad * 2) / contentW, (cssH - pad * 2) / contentH, 2.2);
      const offX = (cssW - contentW * scale) / 2 - minX * scale;
      const offY = (cssH - contentH * scale) / 2 - minY * scale;
      const tx = (x: number) => x * scale + offX;
      const ty = (y: number) => y * scale + offY;

      // グリッド線
      ctx.strokeStyle = "#e9ecef";
      ctx.lineWidth = 1;
      for (let gx = minTX; gx <= maxTX; gx++) {
        const a = project(gx, minTY), b = project(gx, maxTY);
        ctx.beginPath(); ctx.moveTo(tx(a.x), ty(a.y)); ctx.lineTo(tx(b.x), ty(b.y)); ctx.stroke();
      }
      for (let gy = minTY; gy <= maxTY; gy++) {
        const a = project(minTX, gy), b = project(maxTX, gy);
        ctx.beginPath(); ctx.moveTo(tx(a.x), ty(a.y)); ctx.lineTo(tx(b.x), ty(b.y)); ctx.stroke();
      }

      // 占領範囲レイヤー（HQ/旗/像）
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
        rc.forEach((p, i) => { const x = tx(p.x), y = ty(p.y); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
        ctx.closePath();
        ctx.fillStyle = "rgba(64,160,255,0.10)"; ctx.fill();
        ctx.strokeStyle = "rgba(64,160,255,0.35)"; ctx.lineWidth = 1; ctx.stroke();
      }

      // grid → device 変換係数（タイルを回転正方形として描くため）
      const A = TILE_HW * scale * dpr;
      const B = -TILE_HH * scale * dpr;
      const C = -TILE_HW * scale * dpr;
      const D = -TILE_HH * scale * dpr;
      const E = offX * dpr;
      const F = offY * dpr;
      const hasRoundRect = typeof (ctx as unknown as { roundRect?: unknown }).roundRect === "function";

      const ordered = [...objects].sort((a, b) => footprintCenter(a).y - footprintCenter(b).y);

      for (const o of ordered) {
        const st = TYPE_STYLE[o.type];

        // タイル本体（角丸・回転正方形）
        ctx.setTransform(A, B, C, D, E, F);
        const corner = 0.18;
        ctx.beginPath();
        if (hasRoundRect) {
          (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
            .roundRect(o.anchorX, o.anchorY, o.w, o.h, corner);
        } else {
          ctx.rect(o.anchorX, o.anchorY, o.w, o.h);
        }
        ctx.fillStyle = st.fill;
        ctx.fill();
        ctx.lineWidth = 2 / (TILE_HW * scale);
        ctx.strokeStyle = st.stroke;
        ctx.stroke();
        base();

        // 配置の基準点（スクリーン座標）
        const corners = footprintCorners(o).map((p) => ({ x: tx(p.x), y: ty(p.y) }));
        const cen = footprintCenter(o);
        const cx = tx(cen.x), cy = ty(cen.y);
        const topY = Math.min(...corners.map((p) => p.y));
        const botY = Math.max(...corners.map((p) => p.y));
        const tileH = botY - topY;

        // 種別アイコン
        const iconSize = clamp(tileH * 0.42, 12, 34);
        ctx.font = iconSize + "px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(TYPE_ICON[o.type], cx, cy);

        // FCレベル（上の頂点の少し上）
        if (o.fcLevel) {
          const fy = topY - 11;
          const m = /^FC([1-9]|10)$/.exec(o.fcLevel);
          const img = m ? fcImagesRef.current["FC" + m[1]] : undefined;
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, cx - 11, fy - 11, 22, 22);
          } else {
            // 数値（1〜30）= 白丸＋青
            ctx.fillStyle = "#fff";
            ctx.beginPath(); ctx.arc(cx, fy, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#4169E1";
            ctx.beginPath(); ctx.arc(cx, fy, 8.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.font = "bold " + (o.fcLevel.length >= 3 ? 8 : 10) + "px system-ui";
            ctx.fillText(fcDisplay(o.fcLevel).replace("Lv", ""), cx, fy);
          }
        }

        // ラベル（下の頂点の少し下）
        const name = (o.label || "").trim();
        if (name) {
          const ly = botY + 12;
          ctx.font = "600 12px system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          if (NO_BG_LABEL.has(o.type)) {
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.lineWidth = 3;
            ctx.strokeText(name, cx, ly);
            ctx.fillStyle = "#111";
            ctx.fillText(name, cx, ly);
          } else {
            const w = ctx.measureText(name).width;
            const boxW = w + 12, boxH = 16, x0 = cx - boxW / 2, y0 = ly - boxH / 2, r = 6;
            ctx.fillStyle = "rgba(255,255,255,0.92)";
            ctx.strokeStyle = "rgba(0,0,0,0.18)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x0 + r, y0);
            ctx.arcTo(x0 + boxW, y0, x0 + boxW, y0 + boxH, r);
            ctx.arcTo(x0 + boxW, y0 + boxH, x0, y0 + boxH, r);
            ctx.arcTo(x0, y0 + boxH, x0, y0, r);
            ctx.arcTo(x0, y0, x0 + boxW, y0, r);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#111";
            ctx.fillText(name, cx, ly);
          }
          // メンバー名（さらに下に小さく）
          if (o.memberName) {
            ctx.font = "10px system-ui";
            ctx.fillStyle = "#1c7ed6";
            ctx.fillText(o.memberName, cx, botY + 28);
          }
        } else if (o.memberName) {
          ctx.font = "10px system-ui";
          ctx.textAlign = "center";
          ctx.fillStyle = "#1c7ed6";
          ctx.fillText(o.memberName, cx, botY + 12);
        }
      }
    };

    // FC画像のプリロード（読み込み完了で再描画）
    for (let i = 1; i <= 10; i++) {
      const key = "FC" + i;
      if (!fcImagesRef.current[key]) {
        const img = new Image();
        img.onload = () => draw();
        img.src = "/fire-levels/" + key + ".webp";
        fcImagesRef.current[key] = img;
      }
    }

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
