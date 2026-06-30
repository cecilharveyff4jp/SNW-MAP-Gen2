import { useRef, useState } from "react";
import type { PointerEvent as RPE } from "react";

// 一覧のドラッグ並び替え共通フック（スマホ/PC両対応・ポインタ操作）。
// 行のグリップで onPointerDown → 指/カーソルのYで挿入位置を判定し、その場で並びを更新、
// 離した時に sortOrder（グループ内 0..n）をサーバーへ保存する。
// グループ＝同じ data-sortgroup コンテナ内の [data-sortid] 行。
export function useDragSort<T extends { id: number; sortOrder: number }>(
  setItems: (updater: (prev: T[]) => T[]) => void,
  persist: (id: number, patch: { sortOrder: number }) => Promise<void>,
  reload: () => void | Promise<void>,
  onError: (msg: string) => void
) {
  const [dragId, setDragId] = useState<number | null>(null);
  const st = useRef<{ id: number; order: number[]; container: HTMLElement; moved: boolean } | null>(null);

  const onPointerDown = (e: RPE<HTMLElement>, item: T, groupIds: number[]) => {
    const handle = e.currentTarget;
    const container = handle.closest("[data-sortgroup]") as HTMLElement | null;
    if (!container) return;
    e.preventDefault();
    handle.setPointerCapture?.(e.pointerId);
    st.current = { id: item.id, order: groupIds.slice(), container, moved: false };
    setDragId(item.id);
  };

  const onPointerMove = (e: RPE<HTMLElement>) => {
    const s = st.current; if (!s) return;
    const rows = Array.from(s.container.querySelectorAll<HTMLElement>("[data-sortid]"));
    if (rows.length === 0) return;
    const y = e.clientY;
    let target = rows.length - 1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) { target = i; break; }
    }
    const cur = s.order.indexOf(s.id);
    if (cur < 0 || target < 0 || cur === target) return;
    const next = s.order.slice();
    next.splice(cur, 1);
    next.splice(target, 0, s.id);
    s.order = next; s.moved = true;
    // グループ内の並びを sortOrder(0..n) に反映（描画は sortOrder 昇順）
    setItems((prev) => prev.map((x) => { const ni = next.indexOf(x.id); return ni >= 0 ? { ...x, sortOrder: ni } : x; }));
  };

  const onPointerUp = async () => {
    const s = st.current; st.current = null; setDragId(null);
    if (!s || !s.moved) return; // ドラッグしていない（ただのタップ）なら保存しない
    try { for (let i = 0; i < s.order.length; i++) await persist(s.order[i], { sortOrder: i }); }
    catch (e) { onError(String((e as Error).message || e)); await reload(); }
  };

  return { dragId, onPointerDown, onPointerMove, onPointerUp };
}
