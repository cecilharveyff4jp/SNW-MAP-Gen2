import { useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as RPE } from "react";

// 長押しでカードがフロート → ドラッグで並び替え（スマホ/PC共通の定番UI）。
// ・長押し成立(holdMs)前に動いたら「スクロール/タップ」とみなしドラッグしない（縦スクロールを邪魔しない）。
// ・成立後はカードを浮かせ、指/カーソルに追従して中点を越えた相手と入れ替え、離して確定。
// グループ＝同じ data-sortgroup コンテナ内の [data-sortid] 行。
export function useDragSort<T extends { id: number; sortOrder: number }>(
  setItems: (updater: (prev: T[]) => T[]) => void,
  persist: (id: number, patch: { sortOrder: number }) => Promise<void>,
  reload: () => void | Promise<void>,
  onError: (msg: string) => void,
  holdMs = 280
) {
  const [dragId, setDragId] = useState<number | null>(null);
  const st = useRef<{
    id: number; order: number[]; container: HTMLElement; el: HTMLElement; pointerId: number;
    startX: number; startY: number; active: boolean; moved: boolean; timer: number;
  } | null>(null);
  const flipTops = useRef<Map<number, number>>(new Map());
  const [flipTick, setFlipTick] = useState(0);
  const endedAt = useRef(0);

  const clearTimer = () => { const s = st.current; if (s && s.timer) { window.clearTimeout(s.timer); s.timer = 0; } };

  const onPointerDown = (e: RPE<HTMLElement>, item: T, groupIds: number[]) => {
    if (e.button != null && e.button !== 0) return;
    const el = e.currentTarget;
    const container = el.closest("[data-sortgroup]") as HTMLElement | null;
    if (!container) return;
    const pid = e.pointerId;
    const timer = window.setTimeout(() => {
      const s = st.current; if (!s || s.id !== item.id) return;
      try { el.setPointerCapture?.(pid); } catch { /* noop */ }
      s.active = true; setDragId(item.id);
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(12);
    }, holdMs);
    st.current = { id: item.id, order: groupIds.slice(), container, el, pointerId: pid, startX: e.clientX, startY: e.clientY, active: false, moved: false, timer };
  };

  const onPointerMove = (e: RPE<HTMLElement>) => {
    const s = st.current; if (!s) return;
    if (!s.active) {
      // 長押し成立前に動いた＝スクロール/タップ。ドラッグせず解除（縦スクロールを通す）。
      if (Math.abs(e.clientX - s.startX) + Math.abs(e.clientY - s.startY) > 10) { clearTimer(); st.current = null; }
      return;
    }
    e.preventDefault();
    const rows = Array.from(s.container.querySelectorAll<HTMLElement>("[data-sortid]"));
    if (rows.length === 0) return;
    const y = e.clientY;
    let target = rows.length; // 全行の中点より下なら末尾
    for (let i = 0; i < rows.length; i++) { const r = rows[i].getBoundingClientRect(); if (y < r.top + r.height / 2) { target = i; break; } }
    const cur = s.order.indexOf(s.id);
    if (cur < 0) return;
    let insertAt = cur < target ? target - 1 : target; // 自分を抜くと後ろが1つ詰まる
    if (insertAt < 0) insertAt = 0;
    if (insertAt > s.order.length - 1) insertAt = s.order.length - 1;
    if (insertAt === cur) return;
    const next = s.order.filter((id) => id !== s.id);
    next.splice(insertAt, 0, s.id);
    s.order = next; s.moved = true;
    flipTops.current = new Map(rows.map((r) => [Number(r.getAttribute("data-sortid")), r.getBoundingClientRect().top]));
    setItems((prev) => prev.map((x) => { const ni = next.indexOf(x.id); return ni >= 0 ? { ...x, sortOrder: ni } : x; }));
    setFlipTick((t) => t + 1);
  };

  const finish = async () => {
    const s = st.current; clearTimer(); st.current = null;
    if (!s) return;
    if (s.active) { setDragId(null); endedAt.current = Date.now(); }
    if (!s.active || !s.moved) return;
    try { for (let i = 0; i < s.order.length; i++) await persist(s.order[i], { sortOrder: i }); }
    catch (e) { onError(String((e as Error).message || e)); await reload(); }
  };

  // 並べ替え直後、各行を旧位置→新位置へスライド（WAAPI＝inline styleを汚さずReactと非干渉）
  useLayoutEffect(() => {
    const s = st.current; if (!s) return;
    const rows = Array.from(s.container.querySelectorAll<HTMLElement>("[data-sortid]"));
    for (const r of rows) {
      const id = Number(r.getAttribute("data-sortid"));
      const prev = flipTops.current.get(id);
      if (prev == null) continue;
      const delta = prev - r.getBoundingClientRect().top;
      if (!delta) continue;
      r.animate?.([{ transform: "translateY(" + delta + "px)" }, { transform: "translateY(0px)" }], { duration: 170, easing: "ease" });
    }
  }, [flipTick]);

  // ドラッグ直後の click（再生トグル等）を無視するための判定
  const dragJustEnded = () => Date.now() - endedAt.current < 300;

  return { dragId, onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish, dragJustEnded };
}
