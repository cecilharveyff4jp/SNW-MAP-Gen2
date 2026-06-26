import { useCallback, useEffect, useRef } from "react";
import type { MapObject, ObjectType } from "../lib/types";
import { territoryBox, fcDisplay } from "../lib/sizes";

// 座標→画面の線形変換 L（45°回転＋反転）。北が下、X右下・Y左下。直交かつ L∘L=恒等。
const K = Math.SQRT1_2;
const applyL = (x: number, y: number) => ({ x: K * (x - y), y: -K * (x + y) });
const CELL = 28;
const LOOK = { grid: "rgba(80,90,120,0.16)", gridMajor: "rgba(80,90,120,0.30)", majorEvery: 5 };

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
const NO_BG_LABEL = new Set<ObjectType>(["MOUNTAIN", "LAKE", "FLAG"]);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

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
  const camRef = useRef<Cam>({ tx: 0, ty: 0, scale: 0.9 });
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
    canvas.width = Math.floor(viewW * dpr); canvas.height = Math.floor(viewH * dpr);
    const baseT = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    baseT(); ctx.clearRect(0, 0, viewW, viewH);

    const { objects, selectedId } = dataRef.current;
    if (objects.length === 0) {
      ctx.fillStyle = "#9aa6b2"; ctx.font = "14px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("オブジェクトがありません", viewW / 2, viewH / 2); return;
    }

    const xs: number[] = [], ys: number[] = [];
    for (const o of objects) {
      xs.push(o.anchorX, o.anchorX + o.w); ys.push(o.anchorY, o.anchorY + o.h);
      const tb = territoryBox(o); if (tb) { xs.push(tb.x0, tb.x1); ys.push(tb.y0, tb.y1); }
    }
    const minTX = Math.min(...xs) - 2, maxTX = Math.max(...xs) + 2, minTY = Math.min(...ys) - 2, maxTY = Math.max(...ys) + 2;
    const cx = ((minTX + maxTX) / 2) * CELL, cy = ((minTY + maxTY) / 2) * CELL;
    centerRef.current = { cx, cy };

    if (!fittedRef.current && viewW > 0 && viewH > 0) {
      const cs = [applyL(minTX * CELL - cx, minTY * CELL - cy), applyL(maxTX * CELL - cx, minTY * CELL - cy), applyL(maxTX * CELL - cx, maxTY * CELL - cy), applyL(minTX * CELL - cx, maxTY * CELL - cy)];
      const bw = Math.max(...cs.map((p) => p.x)) - Math.min(...cs.map((p) => p.x));
      const bh = Math.max(...cs.map((p) => p.y)) - Math.min(...cs.map((p) => p.y));
      camRef.current.scale = clamp(Math.min((viewW - 80) / bw, (viewH - 110) / bh), 0.15, 3);
      camRef.current.tx = 0; camRef.current.ty = 0; fittedRef.current = true;
    }
    const cam = camRef.current;

    // ---- 第1パス：世界座標（グリッド・占領範囲・タイル） ----
    ctx.save();
    ctx.translate(viewW / 2 + cam.tx, viewH / 2 + cam.ty);
    ctx.scale(cam.scale, cam.scale);
    ctx.transform(K, -K, -K, -K, 0, 0);
    ctx.translate(-cx, -cy);

    for (let x = minTX; x <= maxTX; x++) { const major = x % LOOK.majorEvery === 0; ctx.strokeStyle = major ? LOOK.gridMajor : LOOK.grid; ctx.lineWidth = (major ? 1 : 0.6) / cam.scale; ctx.beginPath(); ctx.moveTo(x * CELL, minTY * CELL); ctx.lineTo(x * CELL, maxTY * CELL); ctx.stroke(); }
    for (let y = minTY; y <= maxTY; y++) { const major = y % LOOK.majorEvery === 0; ctx.strokeStyle = major ? LOOK.gridMajor : LOOK.grid; ctx.lineWidth = (major ? 1 : 0.6) / cam.scale; ctx.beginPath(); ctx.moveTo(minTX * CELL, y * CELL); ctx.lineTo(maxTX * CELL, y * CELL); ctx.stroke(); }

    for (const o of objects) { const tb = territoryBox(o); if (!tb) continue; ctx.fillStyle = "rgba(173,216,230,0.28)"; ctx.fillRect(tb.x0 * CELL, tb.y0 * CELL, (tb.x1 - tb.x0) * CELL, (tb.y1 - tb.y0) * CELL); ctx.strokeStyle = "rgba(100,160,255,0.28)"; ctx.lineWidth = 1 / cam.scale; ctx.strokeRect(tb.x0 * CELL, tb.y0 * CELL, (tb.x1 - tb.x0) * CELL, (tb.y1 - tb.y0) * CELL); }

    const hasRR = typeof (ctx as unknown as { roundRect?: unknown }).roundRect === "function";
    const sorted = [...objects].sort((a, b) => a.anchorY - b.anchorY || a.anchorX - b.anchorX);
    for (const o of sorted) {
      const st = TYPE_STYLE[o.type];
      const gx = o.anchorX * CELL, gy = o.anchorY * CELL, gw = o.w * CELL, gh = o.h * CELL;
      const isSel = o.id != null && o.id === selectedId;
      ctx.save();
      if (isSel) { ctx.shadowColor = "rgba(80,160,255,0.85)"; ctx.shadowBlur = 14; }
      const corner = Math.min(CELL * 0.1, 2.5);
      ctx.beginPath();
      if (hasRR) { (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(gx, gy, gw, gh, corner); } else { ctx.rect(gx, gy, gw, gh); }
      ctx.fillStyle = st.fill; ctx.fill();
      ctx.strokeStyle = isSel ? "rgba(80,160,255,0.95)" : st.stroke; ctx.lineWidth = (isSel ? 2.4 : 1.4) / cam.scale; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // ---- 第2パス：画面座標（名前=中央 / FC=中央の上 / メンバー名=名前の下。原本準拠・一定サイズ） ----
    baseT();
    const fwd = (wx: number, wy: number) => { const r = applyL(wx - cx, wy - cy); return { x: viewW / 2 + cam.tx + r.x * cam.scale, y: viewH / 2 + cam.ty + r.y * cam.scale }; };
    for (const o of sorted) {
      const c = fwd((o.anchorX + o.w / 2) * CELL, (o.anchorY + o.h / 2) * CELL);

      // FC（名前の上 = 中心から28px上）
      if (o.fcLevel) {
        const m = /^FC([1-9]|10)$/.exec(o.fcLevel);
        const img = m ? fcImagesRef.current["FC" + m[1]] : undefined;
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, c.x - 11, c.y - 28, 22, 22);
        } else {
          const fy = c.y - 19;
          ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(c.x, fy, 10, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#4169E1"; ctx.beginPath(); ctx.arc(c.x, fy, 8.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold " + (o.fcLevel.length >= 3 ? 8 : 10) + "px system-ui";
          ctx.fillText(fcDisplay(o.fcLevel).replace("Lv", ""), c.x, fy);
        }
      }

      // 名前（タイル中央・白ピル）
      const primary = (o.label || o.memberName || "").trim();
      const secondary = o.label && o.memberName ? o.memberName : "";
      if (primary) {
        ctx.font = "12px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (NO_BG_LABEL.has(o.type)) {
          ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 3; ctx.strokeText(primary, c.x, c.y);
          ctx.fillStyle = "#1f2937"; ctx.fillText(primary, c.x, c.y);
        } else {
          const w = ctx.measureText(primary).width, boxW = w + 16, boxH = 18, x0 = c.x - boxW / 2, y0 = c.y - boxH / 2, rr = 8;
          ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x0 + rr, y0); ctx.arcTo(x0 + boxW, y0, x0 + boxW, y0 + boxH, rr); ctx.arcTo(x0 + boxW, y0 + boxH, x0, y0 + boxH, rr); ctx.arcTo(x0, y0 + boxH, x0, y0, rr); ctx.arcTo(x0, y0, x0 + boxW, y0, rr); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#111"; ctx.fillText(primary, c.x, c.y);
        }
      }
      // メンバー名（名前の下に小さく）
      if (secondary) {
        ctx.font = "10px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 3; ctx.strokeText(secondary, c.x, c.y + 17);
        ctx.fillStyle = "#1c64d8"; ctx.fillText(secondary, c.x, c.y + 17);
      }
      // ♪ 音楽バッジ（紐づけ曲があるとき・右上）
      if (o.musicIds && o.musicIds.length) {
        const mn = o.musicIds.length, mx = c.x + 14, my = c.y - 14;
        ctx.fillStyle = mn > 1 ? "rgba(147,51,234,0.92)" : "rgba(59,130,246,0.92)";
        ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 11px system-ui";
        ctx.fillText("♪", mx, my);
        if (mn > 1) {
          ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(mx + 7, my - 6, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "bold 8px system-ui"; ctx.fillText(String(mn), mx + 7, my - 6);
        }
      }
    }
  }, []);

  const requestDraw = useCallback(() => { if (rafRef.current != null) return; rafRef.current = window.requestAnimationFrame(() => { rafRef.current = null; draw(); }); }, [draw]);

  const screenToTile = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current!, rect = canvas.getBoundingClientRect(), cam = camRef.current, { cx, cy } = centerRef.current;
    let x = clientX - rect.left - rect.width / 2 - cam.tx, y = clientY - rect.top - rect.height / 2 - cam.ty;
    x /= cam.scale; y /= cam.scale;
    const p = applyL(x, y);
    return { tileX: Math.floor((p.x + cx) / CELL), tileY: Math.floor((p.y + cy) / CELL) };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let dragging = false, moved = false, lastX = 0, lastY = 0;
    const onDown = (e: MouseEvent) => { dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY; };
    const onMove = (e: MouseEvent) => { if (!dragging) return; const dx = e.clientX - lastX, dy = e.clientY - lastY; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; camRef.current.tx += dx; camRef.current.ty += dy; lastX = e.clientX; lastY = e.clientY; requestDraw(); };
    const onUp = (e: MouseEvent) => {
      if (!dragging) return; dragging = false; if (moved) return;
      const d = dataRef.current; if (!d.editable) return;
      const { tileX, tileY } = screenToTile(e.clientX, e.clientY);
      let hit: MapObject | undefined; let hitArea = Infinity;
      for (const o of d.objects) { if (o.id == null) continue; if (tileX >= o.anchorX && tileX < o.anchorX + o.w && tileY >= o.anchorY && tileY < o.anchorY + o.h) { const area = o.w * o.h; if (area <= hitArea) { hitArea = area; hit = o; } } }
      if (hit && hit.id != null) d.onSelectObject?.(hit.id); else d.onClickEmpty?.(tileX, tileY);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect(), mx = e.clientX - rect.left - rect.width / 2, my = e.clientY - rect.top - rect.height / 2, cam = camRef.current;
      const ux = (mx - cam.tx) / cam.scale, uy = (my - cam.ty) / cam.scale, factor = Math.exp(-e.deltaY * 0.0015);
      cam.scale = clamp(cam.scale * factor, 0.15, 4); cam.tx = mx - ux * cam.scale; cam.ty = my - uy * cam.scale; requestDraw();
    };
    canvas.addEventListener("mousedown", onDown); window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp); canvas.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(requestDraw); ro.observe(wrap); requestDraw();
    return () => { canvas.removeEventListener("mousedown", onDown); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); canvas.removeEventListener("wheel", onWheel); ro.disconnect(); };
  }, [requestDraw, screenToTile]);

  useEffect(() => { for (let i = 1; i <= 10; i++) { const key = "FC" + i; if (fcImagesRef.current[key]) continue; const img = new Image(); img.onload = () => requestDraw(); img.src = "/fire-levels/" + key + ".webp"; fcImagesRef.current[key] = img; } }, [requestDraw]);
  useEffect(() => { requestDraw(); }, [objects, selectedId, editable, requestDraw]);

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0 }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", background: "linear-gradient(160deg, #eaf2fb 0%, #f4f8fc 55%, #eef4ee 100%)", cursor: editable ? "pointer" : "grab" }} />
    </div>
  );
}
