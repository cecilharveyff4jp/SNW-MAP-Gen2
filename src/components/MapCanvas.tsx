import { useCallback, useEffect, useRef } from "react";
import type { MapObject, ObjectType } from "../lib/types";
import { territoryBox, fcDisplay } from "../lib/sizes";

const ANGLE = -Math.PI / 4;
const CELL = 28;
const LOOK = { grid: "rgba(0,0,0,0.06)", gridMajor: "rgba(0,0,0,0.12)", majorEvery: 5 };

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
const TYPE_ICON: Record<ObjectType, string> = {
  HQ: "🏰", CITY: "🏠", STATUE: "🗿", DEPOT: "📦",
  BEAR_TRAP: "🐻", MOUNTAIN: "⛰️", LAKE: "💧", FLAG: "🚩",
};
const NO_BG_LABEL = new Set<ObjectType>(["MOUNTAIN", "LAKE", "FLAG"]);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rotate = (x: number, y: number, a: number) => {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
};

interface Props {
  objects: MapObject[];
  selectedId?: number | null;
  editable?: boolean;
  onSelectObject?: (id: number) => void;
  onClickEmpty?: (gx: number, gy: number) => void;
}

interface Cam { tx: number; ty: number; scale: number }

export default function MapCanvas({ objects, selectedId = null, editable = false, onSelectObject, onClickEmpty }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<Cam>({ tx: 0, ty: 0, scale: 0.8 });
  const fcImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const rafRef = useRef<number | null>(null);
  const fittedRef = useRef(false);
  const centerRef = useRef({ cx: 0, cy: 0 });

  const dataRef = useRef({ objects, selectedId, editable, onSelectObject, onClickEmpty });
  dataRef.current = { objects, selectedId, editable, onSelectObject, onClickEmpty };

  const draw = useCallback(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const viewW = wrap.clientWidth, viewH = wrap.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);

    const { objects, selectedId } = dataRef.current;
    if (objects.length === 0) {
      ctx.fillStyle = "#9aa6b2"; ctx.font = "14px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("オブジェクトがありません", viewW / 2, viewH / 2);
      return;
    }

    // content bounds (tile, incl territory)
    const xs: number[] = [], ys: number[] = [];
    for (const o of objects) {
      xs.push(o.anchorX, o.anchorX + o.w); ys.push(o.anchorY, o.anchorY + o.h);
      const tb = territoryBox(o); if (tb) { xs.push(tb.x0, tb.x1); ys.push(tb.y0, tb.y1); }
    }
    const minTX = Math.min(...xs) - 2, maxTX = Math.max(...xs) + 2;
    const minTY = Math.min(...ys) - 2, maxTY = Math.max(...ys) + 2;
    const cx = ((minTX + maxTX) / 2) * CELL, cy = ((minTY + maxTY) / 2) * CELL;
    centerRef.current = { cx, cy };

    // initial fit (once)
    if (!fittedRef.current && viewW > 0 && viewH > 0) {
      const cs = [
        rotate(minTX * CELL - cx, minTY * CELL - cy, ANGLE),
        rotate(maxTX * CELL - cx, minTY * CELL - cy, ANGLE),
        rotate(maxTX * CELL - cx, maxTY * CELL - cy, ANGLE),
        rotate(minTX * CELL - cx, maxTY * CELL - cy, ANGLE),
      ];
      const bw = Math.max(...cs.map((p) => p.x)) - Math.min(...cs.map((p) => p.x));
      const bh = Math.max(...cs.map((p) => p.y)) - Math.min(...cs.map((p) => p.y));
      camRef.current.scale = clamp(Math.min((viewW - 80) / bw, (viewH - 100) / bh), 0.15, 3);
      camRef.current.tx = 0; camRef.current.ty = 0;
      fittedRef.current = true;
    }

    const cam = camRef.current;
    ctx.save();
    ctx.translate(viewW / 2 + cam.tx, viewH / 2 + cam.ty);
    ctx.scale(cam.scale, cam.scale);
    ctx.rotate(ANGLE);
    ctx.translate(-cx, -cy);

    // grid
    for (let x = minTX; x <= maxTX; x++) {
      const major = x % LOOK.majorEvery === 0;
      ctx.strokeStyle = major ? LOOK.gridMajor : LOOK.grid; ctx.lineWidth = (major ? 1.2 : 1) / cam.scale;
      ctx.beginPath(); ctx.moveTo(x * CELL, minTY * CELL); ctx.lineTo(x * CELL, maxTY * CELL); ctx.stroke();
    }
    for (let y = minTY; y <= maxTY; y++) {
      const major = y % LOOK.majorEvery === 0;
      ctx.strokeStyle = major ? LOOK.gridMajor : LOOK.grid; ctx.lineWidth = (major ? 1.2 : 1) / cam.scale;
      ctx.beginPath(); ctx.moveTo(minTX * CELL, y * CELL); ctx.lineTo(maxTX * CELL, y * CELL); ctx.stroke();
    }

    // territory (HQ 15 / FLAG 7)
    for (const o of objects) {
      const tb = territoryBox(o); if (!tb) continue;
      ctx.fillStyle = "rgba(173,216,230,0.30)";
      ctx.fillRect(tb.x0 * CELL, tb.y0 * CELL, (tb.x1 - tb.x0) * CELL, (tb.y1 - tb.y0) * CELL);
      ctx.strokeStyle = "rgba(100,160,255,0.30)"; ctx.lineWidth = 1 / cam.scale;
      ctx.strokeRect(tb.x0 * CELL, tb.y0 * CELL, (tb.x1 - tb.x0) * CELL, (tb.y1 - tb.y0) * CELL);
    }

    const hasRR = typeof (ctx as unknown as { roundRect?: unknown }).roundRect === "function";
    const sorted = [...objects].sort((a, b) => a.anchorY - b.anchorY || a.anchorX - b.anchorX);
    for (const o of sorted) {
      const st = TYPE_STYLE[o.type];
      const gx = o.anchorX * CELL, gy = o.anchorY * CELL, gw = o.w * CELL, gh = o.h * CELL;
      const isSel = o.id != null && o.id === selectedId;

      ctx.save();
      if (isSel) { ctx.shadowColor = "rgba(80,160,255,0.9)"; ctx.shadowBlur = 18; }
      const corner = Math.min(CELL * 0.18, 6);
      ctx.beginPath();
      if (hasRR) { (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(gx, gy, gw, gh, corner); }
      else { ctx.rect(gx, gy, gw, gh); }
      ctx.fillStyle = st.fill; ctx.fill();
      ctx.strokeStyle = isSel ? "rgba(80,160,255,0.95)" : st.stroke; ctx.lineWidth = (isSel ? 3 : 2) / cam.scale; ctx.stroke();
      ctx.restore();

      // 文字類は水平に戻して描画
      ctx.save();
      ctx.translate(gx + gw / 2, gy + gh / 2);
      ctx.rotate(-ANGLE);
      const radius = Math.max(gw, gh) / Math.SQRT2;
      // icon
      const iconSize = clamp(Math.min(gw, gh) * 0.5, 12, 30);
      ctx.font = iconSize + "px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(TYPE_ICON[o.type], 0, 0);
      // FC
      if (o.fcLevel) {
        const fy = -radius - 12;
        const m = /^FC([1-9]|10)$/.exec(o.fcLevel);
        const img = m ? fcImagesRef.current["FC" + m[1]] : undefined;
        if (img && img.complete && img.naturalWidth > 0) { ctx.drawImage(img, -11, fy - 11, 22, 22); }
        else {
          ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, fy, 10, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#4169E1"; ctx.beginPath(); ctx.arc(0, fy, 8.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "bold " + (o.fcLevel.length >= 3 ? 8 : 10) + "px system-ui";
          ctx.fillText(fcDisplay(o.fcLevel).replace("Lv", ""), 0, fy);
        }
      }
      // label
      const name = (o.label || "").trim();
      if (name) {
        const ly = radius + 9;
        ctx.font = "600 12px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (NO_BG_LABEL.has(o.type)) {
          ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 3; ctx.strokeText(name, 0, ly);
          ctx.fillStyle = "#111"; ctx.fillText(name, 0, ly);
        } else {
          const w = ctx.measureText(name).width, boxW = w + 12, boxH = 16, x0 = -boxW / 2, y0 = ly - boxH / 2, rr = 6;
          ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x0 + rr, y0);
          ctx.arcTo(x0 + boxW, y0, x0 + boxW, y0 + boxH, rr);
          ctx.arcTo(x0 + boxW, y0 + boxH, x0, y0 + boxH, rr);
          ctx.arcTo(x0, y0 + boxH, x0, y0, rr);
          ctx.arcTo(x0, y0, x0 + boxW, y0, rr);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#111"; ctx.fillText(name, 0, ly);
        }
        if (o.memberName) { ctx.font = "10px system-ui"; ctx.fillStyle = "#1c7ed6"; ctx.fillText(o.memberName, 0, ly + 15); }
      } else if (o.memberName) {
        ctx.font = "10px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#1c7ed6"; ctx.fillText(o.memberName, 0, radius + 9);
      }
      ctx.restore();
    }
    ctx.restore();
  }, []);

  const requestDraw = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => { rafRef.current = null; draw(); });
  }, [draw]);

  // screen → tile
  const screenToTile = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current!, rect = canvas.getBoundingClientRect();
    const cam = camRef.current, { cx, cy } = centerRef.current;
    let x = clientX - rect.left - rect.width / 2 - cam.tx;
    let y = clientY - rect.top - rect.height / 2 - cam.ty;
    x /= cam.scale; y /= cam.scale;
    const p = rotate(x, y, -ANGLE);
    return { tileX: Math.floor((p.x + cx) / CELL), tileY: Math.floor((p.y + cy) / CELL) };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let dragging = false, moved = false, lastX = 0, lastY = 0;

    const onDown = (e: MouseEvent) => { dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY; };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      camRef.current.tx += dx; camRef.current.ty += dy;
      lastX = e.clientX; lastY = e.clientY;
      requestDraw();
    };
    const onUp = (e: MouseEvent) => {
      if (!dragging) return;
      dragging = false;
      if (moved) return;
      const d = dataRef.current;
      if (!d.editable) return;
      const { tileX, tileY } = screenToTile(e.clientX, e.clientY);
      let hit: MapObject | undefined; let hitArea = Infinity;
      for (const o of d.objects) {
        if (o.id == null) continue;
        if (tileX >= o.anchorX && tileX < o.anchorX + o.w && tileY >= o.anchorY && tileY < o.anchorY + o.h) {
          const area = o.w * o.h; if (area <= hitArea) { hitArea = area; hit = o; }
        }
      }
      if (hit && hit.id != null) d.onSelectObject?.(hit.id);
      else d.onClickEmpty?.(tileX, tileY);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - rect.width / 2;
      const my = e.clientY - rect.top - rect.height / 2;
      const cam = camRef.current;
      const ux = (mx - cam.tx) / cam.scale, uy = (my - cam.ty) / cam.scale;
      const factor = Math.exp(-e.deltaY * 0.0015);
      cam.scale = clamp(cam.scale * factor, 0.15, 4);
      cam.tx = mx - ux * cam.scale; cam.ty = my - uy * cam.scale;
      requestDraw();
    };

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(requestDraw); ro.observe(wrap);
    requestDraw();
    return () => {
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
  }, [requestDraw, screenToTile]);

  // preload FC images
  useEffect(() => {
    for (let i = 1; i <= 10; i++) {
      const key = "FC" + i;
      if (fcImagesRef.current[key]) continue;
      const img = new Image();
      img.onload = () => requestDraw();
      img.src = "/fire-levels/" + key + ".webp";
      fcImagesRef.current[key] = img;
    }
  }, [requestDraw]);

  // redraw on data change
  useEffect(() => { requestDraw(); }, [objects, selectedId, editable, requestDraw]);

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0 }}>
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          background: "linear-gradient(160deg, #eaf2fb 0%, #f4f8fc 55%, #eef4ee 100%)",
          cursor: editable ? "pointer" : "grab",
        }}
      />
    </div>
  );
}
