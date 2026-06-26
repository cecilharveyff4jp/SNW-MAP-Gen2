import { useCallback, useEffect, useRef } from "react";
import type { MapObject, ObjectType } from "../lib/types";
import { territoryBox, fcDisplay } from "../lib/sizes";

const K = Math.SQRT1_2;
const applyL = (x: number, y: number) => ({ x: K * (x - y), y: -K * (x + y) });
const CELL = 28;
const LOOK = { grid: "rgba(80,90,120,0.16)", gridMajor: "rgba(80,90,120,0.30)", majorEvery: 5 };
const TYPE_STYLE: Record<ObjectType, { fill: string; stroke: string }> = {
  HQ: { fill: "rgba(46,107,255,0.55)", stroke: "#1d4ed8" }, BEAR_TRAP: { fill: "rgba(255,138,42,0.55)", stroke: "#c2410c" },
  STATUE: { fill: "rgba(33,195,138,0.55)", stroke: "#15803d" }, CITY: { fill: "rgba(181,107,255,0.45)", stroke: "#7e22ce" },
  DEPOT: { fill: "rgba(180,120,60,0.55)", stroke: "#8B4513" }, MOUNTAIN: { fill: "rgba(120,113,108,0.55)", stroke: "#57534e" },
  LAKE: { fill: "rgba(96,165,250,0.55)", stroke: "#1e40af" }, FLAG: { fill: "rgba(244,114,182,0.55)", stroke: "#be185d" },
};
const NO_BG_LABEL = new Set<ObjectType>(["MOUNTAIN", "LAKE", "FLAG"]);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface Props {
  objects: MapObject[];
  selectedId?: number | null;
  editable?: boolean;
  pending?: { x: number; y: number } | null;
  onSelectObject?: (id: number) => void;
  onClickEmpty?: (gx: number, gy: number) => void;
  onMoveObject?: (id: number, gx: number, gy: number) => void;
}
interface Cam { tx: number; ty: number; scale: number }
interface Drag { id: number; w: number; h: number; offX: number; offY: number; curTileX: number; curTileY: number }

export default function MapCanvas({ objects, selectedId = null, editable = false, pending = null, onSelectObject, onClickEmpty, onMoveObject }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<Cam>({ tx: 0, ty: 0, scale: 0.9 });
  const fcImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const rafRef = useRef<number | null>(null);
  const fittedRef = useRef(false);
  const centerRef = useRef({ cx: 0, cy: 0 });
  const dragRef = useRef<Drag | null>(null);
  const arrowsRef = useRef<{ x: number; y: number; r: number; dx: number; dy: number }[]>([]);
  const dataRef = useRef({ objects, selectedId, editable, pending, onSelectObject, onClickEmpty, onMoveObject });
  dataRef.current = { objects, selectedId, editable, pending, onSelectObject, onClickEmpty, onMoveObject };

  const draw = useCallback(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const viewW = wrap.clientWidth, viewH = wrap.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewW * dpr); canvas.height = Math.floor(viewH * dpr);
    const baseT = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    baseT(); ctx.clearRect(0, 0, viewW, viewH);
    const { objects, selectedId, editable } = dataRef.current;
    const drag = dragRef.current;
    if (objects.length === 0) { ctx.fillStyle = "#9aa6b2"; ctx.font = "14px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText("オブジェクトがありません", viewW / 2, viewH / 2); return; }
    const ax = (o: MapObject) => (drag && drag.id === o.id ? drag.curTileX : o.anchorX);
    const ay = (o: MapObject) => (drag && drag.id === o.id ? drag.curTileY : o.anchorY);
    const xs: number[] = [], ys: number[] = [];
    for (const o of objects) { xs.push(o.anchorX, o.anchorX + o.w); ys.push(o.anchorY, o.anchorY + o.h); const tb = territoryBox(o); if (tb) { xs.push(tb.x0, tb.x1); ys.push(tb.y0, tb.y1); } }
    const minTX = Math.min(...xs) - 2, maxTX = Math.max(...xs) + 2, minTY = Math.min(...ys) - 2, maxTY = Math.max(...ys) + 2;
    const cx = ((minTX + maxTX) / 2) * CELL, cy = ((minTY + maxTY) / 2) * CELL;
    centerRef.current = { cx, cy };
    if (!fittedRef.current && viewW > 0 && viewH > 0) {
      const cs = [applyL(minTX * CELL - cx, minTY * CELL - cy), applyL(maxTX * CELL - cx, minTY * CELL - cy), applyL(maxTX * CELL - cx, maxTY * CELL - cy), applyL(minTX * CELL - cx, maxTY * CELL - cy)];
      const bw = Math.max(...cs.map((p) => p.x)) - Math.min(...cs.map((p) => p.x)); const bh = Math.max(...cs.map((p) => p.y)) - Math.min(...cs.map((p) => p.y));
      camRef.current.scale = clamp(Math.min((viewW - 80) / bw, (viewH - 110) / bh), 0.15, 3); camRef.current.tx = 0; camRef.current.ty = 0; fittedRef.current = true;
    }
    const cam = camRef.current;
    ctx.save();
    ctx.translate(viewW / 2 + cam.tx, viewH / 2 + cam.ty); ctx.scale(cam.scale, cam.scale); ctx.transform(K, -K, -K, -K, 0, 0); ctx.translate(-cx, -cy);
    for (let x = minTX; x <= maxTX; x++) { const major = x % LOOK.majorEvery === 0; ctx.strokeStyle = major ? LOOK.gridMajor : LOOK.grid; ctx.lineWidth = (major ? 1 : 0.6) / cam.scale; ctx.beginPath(); ctx.moveTo(x * CELL, minTY * CELL); ctx.lineTo(x * CELL, maxTY * CELL); ctx.stroke(); }
    for (let y = minTY; y <= maxTY; y++) { const major = y % LOOK.majorEvery === 0; ctx.strokeStyle = major ? LOOK.gridMajor : LOOK.grid; ctx.lineWidth = (major ? 1 : 0.6) / cam.scale; ctx.beginPath(); ctx.moveTo(minTX * CELL, y * CELL); ctx.lineTo(maxTX * CELL, y * CELL); ctx.stroke(); }
    for (const o of objects) { const tb = territoryBox({ type: o.type, anchorX: ax(o), anchorY: ay(o), w: o.w, h: o.h }); if (!tb) continue; ctx.fillStyle = "rgba(173,216,230,0.28)"; ctx.fillRect(tb.x0 * CELL, tb.y0 * CELL, (tb.x1 - tb.x0) * CELL, (tb.y1 - tb.y0) * CELL); ctx.strokeStyle = "rgba(100,160,255,0.28)"; ctx.lineWidth = 1 / cam.scale; ctx.strokeRect(tb.x0 * CELL, tb.y0 * CELL, (tb.x1 - tb.x0) * CELL, (tb.y1 - tb.y0) * CELL); }
    const hasRR = typeof (ctx as unknown as { roundRect?: unknown }).roundRect === "function";
    const sorted = [...objects].sort((a, b) => ay(a) - ay(b) || ax(a) - ax(b));
    for (const o of sorted) {
      const st = TYPE_STYLE[o.type];
      const gx = ax(o) * CELL, gy = ay(o) * CELL, gw = o.w * CELL, gh = o.h * CELL;
      const isSel = o.id != null && o.id === selectedId;
      const isDrag = drag != null && drag.id === o.id;
      ctx.save();
      if (isDrag) { ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6; ctx.globalAlpha = 0.92; }
      else if (isSel) { ctx.shadowColor = "rgba(80,160,255,0.85)"; ctx.shadowBlur = 14; }
      const corner = Math.min(CELL * 0.1, 2.5);
      ctx.beginPath();
      if (hasRR) { (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(gx, gy, gw, gh, corner); } else { ctx.rect(gx, gy, gw, gh); }
      ctx.fillStyle = st.fill; ctx.fill();
      ctx.strokeStyle = isSel || isDrag ? "rgba(80,160,255,0.95)" : st.stroke; ctx.lineWidth = (isSel || isDrag ? 2.4 : 1.4) / cam.scale; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    baseT();
    const fwd = (wx: number, wy: number) => { const r = applyL(wx - cx, wy - cy); return { x: viewW / 2 + cam.tx + r.x * cam.scale, y: viewH / 2 + cam.ty + r.y * cam.scale }; };
    for (const o of sorted) {
      const c = fwd((ax(o) + o.w / 2) * CELL, (ay(o) + o.h / 2) * CELL);
      if (o.fcLevel) {
        const m = /^FC([1-9]|10)$/.exec(o.fcLevel); const img = m ? fcImagesRef.current["FC" + m[1]] : undefined;
        if (img && img.complete && img.naturalWidth > 0) { ctx.drawImage(img, c.x - 11, c.y - 28, 22, 22); }
        else { const fy = c.y - 19; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(c.x, fy, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#4169E1"; ctx.beginPath(); ctx.arc(c.x, fy, 8.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold " + (o.fcLevel.length >= 3 ? 8 : 10) + "px system-ui"; ctx.fillText(fcDisplay(o.fcLevel).replace("Lv", ""), c.x, fy); }
      }
      const primary = (o.label || o.memberName || "").trim();
      if (primary) {
        ctx.font = "12px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (NO_BG_LABEL.has(o.type)) { ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 3; ctx.strokeText(primary, c.x, c.y); ctx.fillStyle = "#1f2937"; ctx.fillText(primary, c.x, c.y); }
        else {
          const w = ctx.measureText(primary).width, boxW = w + 16, boxH = 18, x0 = c.x - boxW / 2, y0 = c.y - boxH / 2, rr = 8;
          ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x0 + rr, y0); ctx.arcTo(x0 + boxW, y0, x0 + boxW, y0 + boxH, rr); ctx.arcTo(x0 + boxW, y0 + boxH, x0, y0 + boxH, rr); ctx.arcTo(x0, y0 + boxH, x0, y0, rr); ctx.arcTo(x0, y0, x0 + boxW, y0, rr); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#111"; ctx.fillText(primary, c.x, c.y);
        }
      }
      if (o.musicIds && o.musicIds.length) {
        const mn = o.musicIds.length, mx = c.x + 14, my = c.y - 14;
        ctx.fillStyle = mn > 1 ? "rgba(147,51,234,0.92)" : "rgba(59,130,246,0.92)"; ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 11px system-ui"; ctx.fillText("♪", mx, my);
        if (mn > 1) { ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(mx + 7, my - 6, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "bold 8px system-ui"; ctx.fillText(String(mn), mx + 7, my - 6); }
      }
    }
    const pend = dataRef.current.pending;
    if (pend) {
      const p = fwd((pend.x + 0.5) * CELL, (pend.y + 0.5) * CELL), s = 11;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s); ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y); ctx.stroke();
      ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s); ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y); ctx.stroke();
    }
    // 選択オブジェクトの周囲に方向矢印（マップ回転に合わせて斜め）。タップで1マス移動。
    arrowsRef.current = [];
    if (editable && selectedId != null) {
      const o = objects.find((ob) => ob.id === selectedId);
      if (o && !(drag && drag.id === o.id)) {
        const c = fwd((o.anchorX + o.w / 2) * CELL, (o.anchorY + o.h / 2) * CELL);
        const R = 17;
        const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of dirs) {
          const sd = applyL(dx, dy); // 単位スクリーン方向
          const half = ((dx !== 0 ? o.w : o.h) / 2) * CELL * cam.scale;
          const dist = half + R + 12;
          const px = c.x + sd.x * dist, py = c.y + sd.y * dist;
          arrowsRef.current.push({ x: px, y: py, r: R + 6, dx, dy });
          ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(37,99,235,0.96)"; ctx.fill();
          ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.stroke();
          ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(sd.y, sd.x));
          ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4.5, -6); ctx.lineTo(-4.5, 6); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
    }
  }, []);

  const requestDraw = useCallback(() => { if (rafRef.current != null) return; rafRef.current = window.requestAnimationFrame(() => { rafRef.current = null; draw(); }); }, [draw]);
  const screenToTile = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current!, rect = canvas.getBoundingClientRect(), cam = camRef.current, { cx, cy } = centerRef.current;
    let x = clientX - rect.left - rect.width / 2 - cam.tx, y = clientY - rect.top - rect.height / 2 - cam.ty; x /= cam.scale; y /= cam.scale;
    const p = applyL(x, y); return { tileX: Math.floor((p.x + cx) / CELL), tileY: Math.floor((p.y + cy) / CELL) };
  }, []);
  const hitObject = useCallback((clientX: number, clientY: number): MapObject | undefined => {
    const { tileX, tileY } = screenToTile(clientX, clientY);
    let hit: MapObject | undefined; let hitArea = Infinity;
    for (const o of dataRef.current.objects) { if (o.id == null) continue; if (tileX >= o.anchorX && tileX < o.anchorX + o.w && tileY >= o.anchorY && tileY < o.anchorY + o.h) { const a = o.w * o.h; if (a <= hitArea) { hitArea = a; hit = o; } } }
    return hit;
  }, [screenToTile]);

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current; if (!canvas || !wrap) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let mode: "none" | "pan" | "object" | "pinch" = "none";
    let startX = 0, startY = 0, lastX = 0, lastY = 0, moved = false;
    let downObjId: number | null = null, downTileX = 0, downTileY = 0;
    let downArrow: { dx: number; dy: number } | null = null;
    let lp: number | null = null;
    let pDist = 0, pScale = 1, pMidX = 0, pMidY = 0;
    const clearLP = () => { if (lp) { clearTimeout(lp); lp = null; } };
    const startObjectDrag = (o: MapObject) => { clearLP(); mode = "object"; dragRef.current = { id: o.id as number, w: o.w, h: o.h, offX: downTileX - o.anchorX, offY: downTileY - o.anchorY, curTileX: o.anchorX, curTileY: o.anchorY }; requestDraw(); };

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        clearLP(); mode = "pinch"; const pts = [...pointers.values()];
        pDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); pScale = camRef.current.scale;
        const rect = canvas.getBoundingClientRect();
        pMidX = (pts[0].x + pts[1].x) / 2 - rect.left - rect.width / 2; pMidY = (pts[0].y + pts[1].y) / 2 - rect.top - rect.height / 2;
        return;
      }
      startX = lastX = e.clientX; startY = lastY = e.clientY; moved = false; downObjId = null; downArrow = null;
      const d = dataRef.current;
      if (d.editable) {
        const rect = canvas.getBoundingClientRect();
        const lx = e.clientX - rect.left, ly = e.clientY - rect.top;
        const hitA = arrowsRef.current.find((a) => (lx - a.x) * (lx - a.x) + (ly - a.y) * (ly - a.y) <= a.r * a.r);
        if (hitA) { downArrow = { dx: hitA.dx, dy: hitA.dy }; return; }
        const t = screenToTile(e.clientX, e.clientY); downTileX = t.tileX; downTileY = t.tileY;
        const o = hitObject(e.clientX, e.clientY);
        if (o && o.id != null) { downObjId = o.id; if (e.pointerType === "touch") { lp = window.setTimeout(() => { lp = null; const cur = dataRef.current.objects.find((x) => x.id === downObjId); if (cur) startObjectDrag(cur); }, 360); } }
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (mode === "pinch" && pointers.size >= 2) {
        const pts = [...pointers.values()]; const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); const cam = camRef.current;
        const ns = clamp(pScale * (dist / (pDist || 1)), 0.15, 4); const ux = (pMidX - cam.tx) / cam.scale, uy = (pMidY - cam.ty) / cam.scale;
        cam.scale = ns; cam.tx = pMidX - ux * ns; cam.ty = pMidY - uy * ns; requestDraw(); return;
      }
      const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
      if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 4) moved = true;
      if (downArrow) return;
      if (mode === "none" && moved) {
        if (downObjId != null && e.pointerType !== "touch") { const o = dataRef.current.objects.find((x) => x.id === downObjId); if (o) startObjectDrag(o); }
        else if (downObjId != null && e.pointerType === "touch") { clearLP(); mode = "pan"; }
        else mode = "pan";
      }
      if (mode === "pan") { camRef.current.tx += dx; camRef.current.ty += dy; requestDraw(); }
      else if (mode === "object" && dragRef.current) { const t = screenToTile(e.clientX, e.clientY); dragRef.current.curTileX = t.tileX - dragRef.current.offX; dragRef.current.curTileY = t.tileY - dragRef.current.offY; requestDraw(); }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId); clearLP();
      const d = dataRef.current;
      if (mode === "pinch") { if (pointers.size < 2) mode = "none"; return; }
      if (downArrow) {
        if (!moved) { const sid = d.selectedId; const o = sid != null ? d.objects.find((x) => x.id === sid) : undefined; if (o && sid != null) d.onMoveObject?.(sid, o.anchorX + downArrow.dx, o.anchorY + downArrow.dy); }
        downArrow = null; mode = "none"; return;
      }
      if (mode === "object" && dragRef.current) {
        const dr = dragRef.current; const o = d.objects.find((x) => x.id === dr.id);
        if (o && (dr.curTileX !== o.anchorX || dr.curTileY !== o.anchorY)) d.onMoveObject?.(dr.id, dr.curTileX, dr.curTileY);
        else if (o) d.onSelectObject?.(dr.id);
        dragRef.current = null; mode = "none"; requestDraw(); return;
      }
      if (mode === "pan") { mode = "none"; return; }
      if (!moved && d.editable) { const o = hitObject(e.clientX, e.clientY); if (o && o.id != null) d.onSelectObject?.(o.id); else { const t = screenToTile(e.clientX, e.clientY); d.onClickEmpty?.(t.tileX, t.tileY); } }
      mode = "none";
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const rect = canvas.getBoundingClientRect(), mx = e.clientX - rect.left - rect.width / 2, my = e.clientY - rect.top - rect.height / 2, cam = camRef.current; const ux = (mx - cam.tx) / cam.scale, uy = (my - cam.ty) / cam.scale, factor = Math.exp(-e.deltaY * 0.0015); cam.scale = clamp(cam.scale * factor, 0.15, 4); cam.tx = mx - ux * cam.scale; cam.ty = my - uy * cam.scale; requestDraw(); };

    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp); canvas.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(requestDraw); ro.observe(wrap); requestDraw();
    return () => { canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp); canvas.removeEventListener("wheel", onWheel); ro.disconnect(); };
  }, [requestDraw, screenToTile, hitObject]);

  useEffect(() => { for (let i = 1; i <= 10; i++) { const key = "FC" + i; if (fcImagesRef.current[key]) continue; const img = new Image(); img.onload = () => requestDraw(); img.src = "/fire-levels/" + key + ".webp"; fcImagesRef.current[key] = img; } }, [requestDraw]);
  useEffect(() => { requestDraw(); }, [objects, selectedId, editable, pending, requestDraw]);

  return (<div ref={wrapRef} style={{ position: "absolute", inset: 0 }}><canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", touchAction: "none", background: "linear-gradient(160deg, #eaf2fb 0%, #f4f8fc 55%, #eef4ee 100%)", cursor: editable ? "pointer" : "grab" }} /></div>);
}
