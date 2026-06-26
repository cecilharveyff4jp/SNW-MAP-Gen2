import type { ObjectType } from "./types";

// 種別ごとのデフォルト縦横サイズ（旧版踏襲）。
export function getDefaultSize(type: ObjectType): { w: number; h: number } {
  switch (type) {
    case "HQ":
      return { w: 4, h: 4 };
    case "FLAG":
    case "MOUNTAIN":
    case "LAKE":
      return { w: 1, h: 1 };
    default:
      return { w: 2, h: 2 };
  }
}

// 占領範囲：オブジェクトの各辺からの「余白タイル数」。本部=各辺+6 / 旗=各辺+3。
// （footprint を四方に margin だけ広げた正方形。サイズに依らず対称に広がる）
export const TERRITORY_MARGIN: Partial<Record<ObjectType, number>> = {
  HQ: 6,
  FLAG: 3,
};

export function territoryMargin(type: ObjectType): number {
  return TERRITORY_MARGIN[type] ?? 0;
}

export interface Footprint {
  type: ObjectType;
  anchorX: number;
  anchorY: number;
  w: number;
  h: number;
}

// 占領範囲のグリッド線座標ボックス（無ければ null）。各辺から margin だけ拡張。
export function territoryBox(
  o: Footprint
): { x0: number; y0: number; x1: number; y1: number } | null {
  const m = territoryMargin(o.type);
  if (!m) return null;
  return { x0: o.anchorX - m, y0: o.anchorY - m, x1: o.anchorX + o.w + m, y1: o.anchorY + o.h + m };
}

// 重なり判定：フットプリント（占有タイル）同士が交差するか。占領範囲は対象外。
export interface Rect { anchorX: number; anchorY: number; w: number; h: number }
export function footOverlap(a: Rect, b: Rect): boolean {
  return a.anchorX < b.anchorX + b.w && a.anchorX + a.w > b.anchorX && a.anchorY < b.anchorY + b.h && a.anchorY + a.h > b.anchorY;
}
// target が objs のいずれかと重なるか（ignoreId は自分自身として除外）。
export function overlapsAny(target: Rect, objs: { id?: number; anchorX: number; anchorY: number; w: number; h: number }[], ignoreId?: number): boolean {
  for (const o of objs) { if (o.id != null && o.id === ignoreId) continue; if (footOverlap(target, o)) return true; }
  return false;
}

// FCレベルの選択肢：炉レベル 1〜30 → 火結晶 FC1〜FC10。
export const FC_LEVELS: string[] = [
  ...Array.from({ length: 30 }, (_, i) => String(i + 1)),
  ...Array.from({ length: 10 }, (_, i) => "FC" + (i + 1)),
];

// 表示用：数値は「Lv25」、FCは「FC5」のまま。
export function fcDisplay(v: string): string {
  return /^\d+$/.test(v) ? "Lv" + v : v;
}
