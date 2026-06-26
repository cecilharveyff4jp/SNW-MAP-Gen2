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

// 占領範囲（チェビシェフ距離＝正方形）のタイル半径。
// ※暫定値。正確な値は要確認のうえ差し替え。
export const RANGE_RADIUS: Partial<Record<ObjectType, number>> = {
  HQ: 7,
  FLAG: 3,
  STATUE: 3,
};

export function rangeOf(type: ObjectType): number {
  return RANGE_RADIUS[type] ?? 0;
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
