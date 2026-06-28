import { useCallback, useEffect, useRef } from "react";
import type { MapObject, ObjectType } from "../lib/types";
import { territoryBox, fcDisplay, overlapsAny } from "../lib/sizes";

const K = Math.SQRT1_2;
const applyL = (x: number, y: number) => ({ x: K * (x - y), y: -K * (x + y) });
const CELL = 28;
function hexToRgbStr(hex: string): string {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return "91,91,214";
  const n = parseInt(h, 16);
  if (isNaN(n)) return "91,91,214";
  return ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255);
}
const LOOK = { grid: "rgba(70,80,110,0.08)", gridMajor: "rgba(70,80,110,0.16)", majorEvery: 5 };
const TYPE_STYLE: Record<ObjectType, { fill: string; stroke: string }> = {
  HQ: { fill: "rgba(91,91,214,0.80)", stroke: "#4338ca" }, BEAR_TRAP: { fill: "rgba(255,150,60,0.72)", stroke: "#d2691e" },
  STATUE: { fill: "rgba(45,200,150,0.70)", stroke: "#0f9d6b" }, CITY: { fill: "rgba(168,134,240,0.66)", stroke: "#7c4dd0" },
  DEPOT: { fill: "rgba(196,140,80,0.70)", stroke: "#9a6324" }, MOUNTAIN: { fill: "rgba(140,150,168,0.70)", stroke: "#5b6472" },
  LAKE: { fill: "rgba(96,170,235,0.70)", stroke: "#2272c4" }, FLAG: { fill: "rgba(244,130,190,0.70)", stroke: "#c43f86" },
  OTHER: { fill: "rgba(90,100,120,0.72)", stroke: "#3b4252" },
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// 地形（山・湖・旗）をフラットなアウトラインで描画。24x24 viewBox 基準を size に合わせて中央配置。
function drawTerrainIcon(ctx: CanvasRenderingContext2D, type: ObjectType, cx: number, cy: number, size: number, color: string) {
  const s = size / 24, ox = cx - size / 2, oy = cy - size / 2;
  const X = (x: number) => ox + x * s, Y = (y: number) => oy + y * s;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.shadowColor = "rgba(255,255,255,0.95)"; ctx.shadowBlur = 4;
  ctx.beginPath();
  if (type === "MOUNTAIN") {
    ctx.moveTo(X(2), Y(20)); ctx.lineTo(X(8.5), Y(7)); ctx.lineTo(X(12.5), Y(14)); ctx.lineTo(X(15.5), Y(8.5)); ctx.lineTo(X(22), Y(20)); ctx.closePath();
    ctx.moveTo(X(8.5), Y(7)); ctx.lineTo(X(11), Y(11)); ctx.lineTo(X(9.5), Y(13));
  } else if (type === "LAKE") {
    for (const y of [8, 13, 18]) {
      ctx.moveTo(X(2), Y(y));
      ctx.quadraticCurveTo(X(5), Y(y - 3), X(8), Y(y));
      ctx.quadraticCurveTo(X(11), Y(y + 3), X(14), Y(y));
      ctx.quadraticCurveTo(X(17), Y(y - 3), X(20), Y(y));
    }
  } else {
    ctx.moveTo(X(5), Y(22)); ctx.lineTo(X(5), Y(3));
    ctx.moveTo(X(5), Y(4));
    ctx.bezierCurveTo(X(9), Y(1.5), X(13), Y(6.5), X(20), Y(4));
    ctx.lineTo(X(20), Y(13));
    ctx.bezierCurveTo(X(13), Y(15.5), X(9), Y(10.5), X(5), Y(13));
  }
  ctx.stroke();
  ctx.restore();
}

// 縮小時に種別を表すフラットアイコン（本部=拠点 / 同盟建造物=神殿 / 同盟資材=箱 / 熊罠=照準）。
function drawTypeIcon(ctx: CanvasRenderingContext2D, type: ObjectType, cx: number, cy: number, size: number, color: string) {
  const s = size / 24, ox = cx - size / 2, oy = cy - size / 2;
  const X = (x: number) => ox + x * s, Y = (y: number) => oy + y * s;
  const TWO = Math.PI * 2;
  const dot = (px: number, py: number, r: number) => { ctx.moveTo(X(px) + r * s, Y(py)); ctx.arc(X(px), Y(py), r * s, 0, TWO); };
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.shadowColor = "rgba(255,255,255,0.95)"; ctx.shadowBlur = 4;
  ctx.beginPath();
  if (type === "HQ") {
    ctx.moveTo(X(3), Y(9)); ctx.lineTo(X(12), Y(4)); ctx.lineTo(X(21), Y(9));
    ctx.moveTo(X(5), Y(10)); ctx.lineTo(X(5), Y(20));
    ctx.moveTo(X(19), Y(10)); ctx.lineTo(X(19), Y(20));
    ctx.moveTo(X(9.5), Y(12)); ctx.lineTo(X(9.5), Y(20));
    ctx.moveTo(X(14.5), Y(12)); ctx.lineTo(X(14.5), Y(20));
    ctx.moveTo(X(3), Y(20.5)); ctx.lineTo(X(21), Y(20.5));
  } else if (type === "STATUE") {
    ctx.moveTo(X(7), Y(8)); ctx.lineTo(X(12), Y(3)); ctx.lineTo(X(17), Y(8));
    ctx.moveTo(X(8.5), Y(9)); ctx.lineTo(X(8.5), Y(18));
    ctx.moveTo(X(12), Y(9)); ctx.lineTo(X(12), Y(18));
    ctx.moveTo(X(15.5), Y(9)); ctx.lineTo(X(15.5), Y(18));
    ctx.moveTo(X(6), Y(18)); ctx.lineTo(X(18), Y(18)); ctx.lineTo(X(18), Y(21)); ctx.lineTo(X(6), Y(21)); ctx.closePath();
  } else if (type === "DEPOT") {
    ctx.moveTo(X(12), Y(3)); ctx.lineTo(X(21), Y(7.5)); ctx.lineTo(X(12), Y(12)); ctx.lineTo(X(3), Y(7.5)); ctx.closePath();
    ctx.moveTo(X(3), Y(7.5)); ctx.lineTo(X(3), Y(16.5)); ctx.lineTo(X(12), Y(21)); ctx.lineTo(X(21), Y(16.5)); ctx.lineTo(X(21), Y(7.5));
    ctx.moveTo(X(12), Y(12)); ctx.lineTo(X(12), Y(21));
  } else {
    dot(12, 12, 9);
    dot(12, 12, 3);
    ctx.moveTo(X(12), Y(1)); ctx.lineTo(X(12), Y(5));
    ctx.moveTo(X(12), Y(19)); ctx.lineTo(X(12), Y(23));
    ctx.moveTo(X(1), Y(12)); ctx.lineTo(X(5), Y(12));
    ctx.moveTo(X(19), Y(12)); ctx.lineTo(X(23), Y(12));
  }
  ctx.stroke();
  ctx.restore();
}

interface Props {
  objects: MapObject[];
  selectedId?: number | null;
  editable?: boolean;
  pending?: { x: number; y: number; w: number; h: number } | null;
  myCityId?: number | null;
  focusId?: number | null;
  focusNonce?: number;
  onSelectObject?: (id: number) => void;
  onClickEmpty?: (gx: number, gy: number) => void;
  onMoveObject?: (id: number, gx: number, gy: number) => void;
  onMovePending?: (gx: number, gy: number) => void;
  onZoom?: (scale: number) => void;
  dark?: boolean;
}
interface Cam { tx: number; ty: number; scale: number }
interface Drag { id: number; w: number; h: number; offX: number; offY: number; curTileX: number; curTileY: number }

export default function MapCanvas({ objects, selectedId = null, editable = false, pending = null, myCityId = null, focusId = null, focusNonce = 0, onSelectObject, onClickEmpty, onMoveObject, onMovePending, onZoom, dark = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<Cam>({ tx: 0, ty: 0, scale: 1 });
  const fcImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const rafRef = useRef<number | null>(null);
  const fittedRef = useRef(false);
  const centerRef = useRef({ cx: 0, cy: 0 });
  const dragRef = useRef<Drag | null>(null);
  const arrowsRef = useRef<{ x: number; y: number; r: number; dx: number; dy: number }[]>([]);
  const hoverRef = useRef<number | null>(null);
  const focusPendingRef = useRef(true);
  const lastZoomRef = useRef(0);
  const dataRef = useRef({ objects, selectedId, editable, pending, myCityId, focusId, onSelectObject, onClickEmpty, onMoveObject, onMovePending, onZoom, dark });
  dataRef.current = { objects, selectedId, editable, pending, myCityId, focusId, onSelectObject, onClickEmpty, onMoveObject, onMovePending, onZoom, dark };

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
    const dk = dataRef.current.dark;
    const now = performance.now();
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
      camRef.current.scale = 1; camRef.current.tx = 0; camRef.current.ty = 0; fittedRef.current = true;
    }
    // 自分の都市を中央へパン（マップ表示・更新時）
    if (focusPendingRef.current && viewW > 0 && viewH > 0) {
      const fid = dataRef.current.focusId ?? dataRef.current.myCityId;
      const fo = fid != null ? objects.find((o) => o.id === fid) : undefined;
      if (fo) {
        const r = applyL((fo.anchorX + fo.w / 2) * CELL - cx, (fo.anchorY + fo.h / 2) * CELL - cy);
        camRef.current.tx = -r.x * camRef.current.scale; camRef.current.ty = -r.y * camRef.current.scale;
      }
      focusPendingRef.current = false;
    }
    const cam = camRef.current;
    if (Math.abs(cam.scale - lastZoomRef.current) > 0.005) { lastZoomRef.current = cam.scale; dataRef.current.onZoom?.(cam.scale); }
    ctx.save();
    ctx.translate(viewW / 2 + cam.tx, viewH / 2 + cam.ty); ctx.scale(cam.scale, cam.scale); ctx.transform(K, -K, -K, -K, 0, 0); ctx.translate(-cx, -cy);
    const accentRaw = (typeof getComputedStyle !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() : "") || "#5b5bd6";
    const aRGB = hexToRgbStr(accentRaw);
    const gMaj = "rgba(" + aRGB + "," + (dk ? 0.24 : 0.18) + ")"; const gMin = "rgba(" + aRGB + "," + (dk ? 0.12 : 0.09) + ")";
    for (let x = minTX; x <= maxTX; x++) { const major = x % LOOK.majorEvery === 0; ctx.strokeStyle = major ? gMaj : gMin; ctx.lineWidth = (major ? 1 : 0.6) / cam.scale; ctx.beginPath(); ctx.moveTo(x * CELL, minTY * CELL); ctx.lineTo(x * CELL, maxTY * CELL); ctx.stroke(); }
    for (let y = minTY; y <= maxTY; y++) { const major = y % LOOK.majorEvery === 0; ctx.strokeStyle = major ? gMaj : gMin; ctx.lineWidth = (major ? 1 : 0.6) / cam.scale; ctx.beginPath(); ctx.moveTo(minTX * CELL, y * CELL); ctx.lineTo(maxTX * CELL, y * CELL); ctx.stroke(); }
    for (const o of objects) { const tb = territoryBox({ type: o.type, anchorX: ax(o), anchorY: ay(o), w: o.w, h: o.h }); if (!tb) continue; ctx.fillStyle = "rgba(91,91,214,0.07)"; ctx.fillRect(tb.x0 * CELL, tb.y0 * CELL, (tb.x1 - tb.x0) * CELL, (tb.y1 - tb.y0) * CELL); ctx.strokeStyle = "rgba(91,91,214,0.18)"; ctx.lineWidth = 1 / cam.scale; ctx.strokeRect(tb.x0 * CELL, tb.y0 * CELL, (tb.x1 - tb.x0) * CELL, (tb.y1 - tb.y0) * CELL); }
    const hasRR = typeof (ctx as unknown as { roundRect?: unknown }).roundRect === "function";
    const sorted = [...objects].sort((a, b) => ay(a) - ay(b) || ax(a) - ax(b));
    for (const o of sorted) {
      const st = TYPE_STYLE[o.type];
      const gx = ax(o) * CELL, gy = ay(o) * CELL, gw = o.w * CELL, gh = o.h * CELL;
      const isSel = o.id != null && o.id === selectedId;
      const isDrag = drag != null && drag.id === o.id;
      const over = editable && overlapsAny({ anchorX: ax(o), anchorY: ay(o), w: o.w, h: o.h }, objects, o.id);
      const isHover = !isSel && !isDrag && !over && o.id != null && o.id === hoverRef.current;
      ctx.save();
      const corner = Math.min(CELL * 0.22, 5);
      if (over) { ctx.shadowColor = "rgba(214,51,108,0.9)"; ctx.shadowBlur = 18; }
      else if (isSel) { ctx.shadowColor = "rgba(91,91,214,0.95)"; ctx.shadowBlur = 14 + 10 * (0.5 + 0.5 * Math.sin(now / 480)); }
      else if (o.type === "HQ") { ctx.shadowColor = "rgba(91,91,214,0.55)"; ctx.shadowBlur = 16; }
      else if (isHover) { ctx.shadowColor = dk ? "rgba(0,0,0,0.62)" : "rgba(20,28,54,0.5)"; ctx.shadowBlur = dk ? 16 : 13; ctx.shadowOffsetY = 5; }
      else { ctx.shadowColor = dk ? "rgba(0,0,0,0.55)" : "rgba(20,28,54,0.4)"; ctx.shadowBlur = dk ? 9 : 7; ctx.shadowOffsetY = 2; }
      if (isDrag) { ctx.globalAlpha = 0.92; }
      ctx.beginPath();
      if (hasRR) { (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(gx, gy, gw, gh, corner); } else { ctx.rect(gx, gy, gw, gh); }
      ctx.fillStyle = st.fill; ctx.fill();
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      const sheen = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh);
      sheen.addColorStop(0, "rgba(255,255,255,0)"); sheen.addColorStop(1, "rgba(255,255,255,0.32)");
      ctx.fillStyle = sheen; ctx.fill();
      ctx.strokeStyle = over ? "#d6336c" : (isSel || isDrag ? "rgba(91,91,214,0.95)" : st.stroke); ctx.lineWidth = (over ? 3.2 : isSel || isDrag ? 2.2 : 1.2) / cam.scale; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    baseT();
    const fwd = (wx: number, wy: number) => { const r = applyL(wx - cx, wy - cy); return { x: viewW / 2 + cam.tx + r.x * cam.scale, y: viewH / 2 + cam.ty + r.y * cam.scale }; };
    // ズームアウト時は名前を隠し、溶鉱炉レベル（FC）アイコンを前面（中央）に出す。
    const showLabels = cam.scale >= 0.6;
    const showIcons = cam.scale >= 0.32;
    const iconCol = (t: ObjectType) => (dk ? "rgba(255,255,255,0.92)" : TYPE_STYLE[t].stroke);
    for (const o of sorted) {
      const c = fwd((ax(o) + o.w / 2) * CELL, (ay(o) + o.h / 2) * CELL);
      if (o.fcLevel) {
        const m = /^FC([1-9]|10)$/.exec(o.fcLevel); const img = m ? fcImagesRef.current["FC" + m[1]] : undefined;
        if (img && img.complete && img.naturalWidth > 0) { ctx.drawImage(img, c.x - 11, (showLabels ? c.y - 28 : c.y - 11), 22, 22); }
        else { const fy = showLabels ? c.y - 19 : c.y; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(c.x, fy, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#4169E1"; ctx.beginPath(); ctx.arc(c.x, fy, 8.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold " + (o.fcLevel.length >= 3 ? 8 : 10) + "px system-ui"; ctx.fillText(fcDisplay(o.fcLevel).replace("Lv", ""), c.x, fy); }
      }
      if (o.type === "MOUNTAIN" || o.type === "LAKE" || o.type === "FLAG") {
        if (showIcons) drawTerrainIcon(ctx, o.type, c.x, c.y, 24, iconCol(o.type));
      } else if (showLabels) {
        if (o.type === "HQ" || o.type === "STATUE" || o.type === "DEPOT" || o.type === "BEAR_TRAP") {
          drawTypeIcon(ctx, o.type, c.x, c.y - 22, 17, iconCol(o.type));
        }
        const primary = (o.label || o.memberName || "").trim();
        if (primary) {
          ctx.font = "12px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          const w = ctx.measureText(primary).width, boxW = w + 16, boxH = 18, x0 = c.x - boxW / 2, y0 = c.y - boxH / 2, rr = 8;
          const dark = o.type === "OTHER";
          ctx.fillStyle = dark ? "rgba(52,58,64,0.9)" : "rgba(255,255,255,0.85)"; ctx.strokeStyle = dark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.12)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x0 + rr, y0); ctx.arcTo(x0 + boxW, y0, x0 + boxW, y0 + boxH, rr); ctx.arcTo(x0 + boxW, y0 + boxH, x0, y0 + boxH, rr); ctx.arcTo(x0, y0 + boxH, x0, y0, rr); ctx.arcTo(x0, y0, x0 + boxW, y0, rr); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = dark ? "#fff" : "#111"; ctx.fillText(primary, c.x, c.y);
        }
      } else if (o.type === "HQ" || o.type === "STATUE" || o.type === "DEPOT" || o.type === "BEAR_TRAP") {
        if (!o.fcLevel && showIcons) drawTypeIcon(ctx, o.type, c.x, c.y, 24, iconCol(o.type));
      }
      if (showLabels && o.musicIds && o.musicIds.length) {
        const mn = o.musicIds.length, mx = c.x, my = c.y + 16;
        ctx.fillStyle = mn > 1 ? "rgba(147,51,234,0.95)" : "rgba(59,130,246,0.95)"; ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,255,0.92)"; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 11px system-ui"; ctx.fillText("♪", mx, my);
        if (mn > 1) { ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(mx + 7, my - 6, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "bold 8px system-ui"; ctx.fillText(String(mn), mx + 7, my - 6); }
      }
    }
    const pend = dataRef.current.pending;
    if (pend) {
      const overP = overlapsAny({ anchorX: pend.x, anchorY: pend.y, w: pend.w, h: pend.h }, objects);
      const col = overP ? "#d6336c" : "#2f9e44";
      const cs = [fwd(pend.x * CELL, pend.y * CELL), fwd((pend.x + pend.w) * CELL, pend.y * CELL), fwd((pend.x + pend.w) * CELL, (pend.y + pend.h) * CELL), fwd(pend.x * CELL, (pend.y + pend.h) * CELL)];
      ctx.beginPath(); ctx.moveTo(cs[0].x, cs[0].y); for (let i = 1; i < 4; i++) ctx.lineTo(cs[i].x, cs[i].y); ctx.closePath();
      ctx.fillStyle = overP ? "rgba(214,51,108,0.18)" : "rgba(47,158,68,0.16)"; ctx.fill();
      ctx.setLineDash([6, 4]); ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.stroke(); ctx.setLineDash([]);
      const p = fwd((pend.x + pend.w / 2) * CELL, (pend.y + pend.h / 2) * CELL), s = 11;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s); ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 4;
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
    // 自分の都市を金色で強調（リング＋★）
    const mc = dataRef.current.myCityId;
    if (mc != null) {
      const o = objects.find((ob) => ob.id === mc);
      if (o) {
        const m = 0.18;
        const x0 = (o.anchorX - m) * CELL, y0 = (o.anchorY - m) * CELL, x1 = (o.anchorX + o.w + m) * CELL, y1 = (o.anchorY + o.h + m) * CELL;
        const cs2 = [fwd(x0, y0), fwd(x1, y0), fwd(x1, y1), fwd(x0, y1)];
        ctx.save();
        ctx.shadowColor = "rgba(245,159,0,0.95)"; ctx.shadowBlur = 9 + 8 * (0.5 + 0.5 * Math.sin(now / 520));
        ctx.strokeStyle = "#f59f00"; ctx.lineWidth = 4; ctx.setLineDash([8, 5]); ctx.lineDashOffset = -((now / 55) % 13); ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(cs2[0].x, cs2[0].y); for (let i = 1; i < 4; i++) ctx.lineTo(cs2[i].x, cs2[i].y); ctx.closePath(); ctx.stroke();
        ctx.restore();
        ctx.setLineDash([]);
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
    let mode: "none" | "pan" | "object" | "pinch" | "pending" = "none";
    let pendingDrag: { offX: number; offY: number } | null = null;
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
        else if (d.pending && downTileX >= d.pending.x && downTileX < d.pending.x + d.pending.w && downTileY >= d.pending.y && downTileY < d.pending.y + d.pending.h) { pendingDrag = { offX: downTileX - d.pending.x, offY: downTileY - d.pending.y }; }
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) {
        if (e.pointerType === "mouse") { const o = hitObject(e.clientX, e.clientY); const hid = o && o.id != null ? o.id : null; if (hid !== hoverRef.current) { hoverRef.current = hid; requestDraw(); } }
        return;
      }
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
        if (pendingDrag) mode = "pending";
        else if (downObjId != null && e.pointerType !== "touch") { const o = dataRef.current.objects.find((x) => x.id === downObjId); if (o) startObjectDrag(o); }
        else if (downObjId != null && e.pointerType === "touch") { clearLP(); mode = "pan"; }
        else mode = "pan";
      }
      if (mode === "pan") { camRef.current.tx += dx; camRef.current.ty += dy; requestDraw(); }
      else if (mode === "object" && dragRef.current) { const t = screenToTile(e.clientX, e.clientY); dragRef.current.curTileX = t.tileX - dragRef.current.offX; dragRef.current.curTileY = t.tileY - dragRef.current.offY; requestDraw(); }
      else if (mode === "pending" && pendingDrag) { const t = screenToTile(e.clientX, e.clientY); dataRef.current.onMovePending?.(t.tileX - pendingDrag.offX, t.tileY - pendingDrag.offY); }
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
        // ドラッグ操作では編集モーダルを開かない（モーダルは「タップ」だけ）
        dragRef.current = null; mode = "none"; requestDraw(); return;
      }
      if (mode === "pan") { mode = "none"; return; }
      if (mode === "pending") { pendingDrag = null; mode = "none"; return; }
      if (pendingDrag) { pendingDrag = null; mode = "none"; return; }
      if (!moved) { const o = hitObject(e.clientX, e.clientY); if (o && o.id != null) d.onSelectObject?.(o.id); else { const t = screenToTile(e.clientX, e.clientY); d.onClickEmpty?.(t.tileX, t.tileY); } }
      mode = "none";
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const rect = canvas.getBoundingClientRect(), mx = e.clientX - rect.left - rect.width / 2, my = e.clientY - rect.top - rect.height / 2, cam = camRef.current; const ux = (mx - cam.tx) / cam.scale, uy = (my - cam.ty) / cam.scale, factor = Math.exp(-e.deltaY * 0.0015); cam.scale = clamp(cam.scale * factor, 0.15, 4); cam.tx = mx - ux * cam.scale; cam.ty = my - uy * cam.scale; requestDraw(); };

    const onLeave = () => { if (hoverRef.current != null) { hoverRef.current = null; requestDraw(); } };
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp); canvas.addEventListener("pointerleave", onLeave); canvas.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(requestDraw); ro.observe(wrap); requestDraw();
    return () => { canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp); canvas.removeEventListener("pointerleave", onLeave); canvas.removeEventListener("wheel", onWheel); ro.disconnect(); };
  }, [requestDraw, screenToTile, hitObject]);

  useEffect(() => { for (let i = 1; i <= 10; i++) { const key = "FC" + i; if (fcImagesRef.current[key]) continue; const img = new Image(); img.onload = () => requestDraw(); img.src = "/fire-levels/" + key + ".webp"; fcImagesRef.current[key] = img; } }, [requestDraw]);
  useEffect(() => { requestDraw(); }, [objects, selectedId, editable, pending, myCityId, dark, requestDraw]);
  useEffect(() => { focusPendingRef.current = true; requestDraw(); }, [focusNonce, requestDraw]);
  useEffect(() => { if (selectedId == null && myCityId == null) return; let raf = 0; const loop = () => { requestDraw(); raf = window.requestAnimationFrame(loop); }; raf = window.requestAnimationFrame(loop); return () => window.cancelAnimationFrame(raf); }, [selectedId, myCityId, requestDraw]);

  return (<div ref={wrapRef} style={{ position: "absolute", inset: 0 }}><canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", touchAction: "none", background: dark ? "radial-gradient(125% 95% at 50% 30%, #1b2535 0%, #121a27 55%, #0b1018 100%)" : "radial-gradient(125% 95% at 50% 32%, #ffffff 0%, #f2f3fa 52%, #e6e8f2 100%)", cursor: editable ? "pointer" : "grab" }} /><div style={{ position: "absolute", inset: 0, pointerEvents: "none", boxShadow: dark ? "inset 0 0 150px rgba(0,0,0,0.55)" : "inset 0 0 130px rgba(40,52,92,0.13)" }} /></div>);
}
