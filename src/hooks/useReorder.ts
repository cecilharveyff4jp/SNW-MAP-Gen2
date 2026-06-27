import { useState } from "react";

// 一覧の↑↓並び替え共通フック。隣と sort_order を入れ替え、画面はその場で更新
// （リロードで先頭へ飛ばない）し、移動した行を一定時間ハイライトする。
export function useReorder<T extends { id: number; sortOrder: number }>(
  update: (id: number, patch: { sortOrder: number }) => Promise<void>,
  reload: () => void | Promise<void>,
  onError: (msg: string) => void
) {
  const [flashId, setFlashId] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);

  async function move(list: T[], item: T, dir: "up" | "down", setItems: (updater: (prev: T[]) => T[]) => void) {
    if (moving) return;
    const i = list.findIndex((x) => x.id === item.id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return;
    const a = list[i], b = list[j];
    const ao = a.sortOrder;
    const bo = b.sortOrder === a.sortOrder ? a.sortOrder + (dir === "up" ? -1 : 1) : b.sortOrder;
    setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, sortOrder: bo } : x.id === b.id ? { ...x, sortOrder: ao } : x)));
    setFlashId(a.id);
    window.setTimeout(() => setFlashId((cur) => (cur === a.id ? null : cur)), 1100);
    setMoving(true);
    try {
      await update(a.id, { sortOrder: bo });
      await update(b.id, { sortOrder: ao });
    } catch (e) {
      onError(String((e as Error).message || e));
      await reload();
    } finally {
      setMoving(false);
    }
  }

  return { move, flashId, moving };
}
