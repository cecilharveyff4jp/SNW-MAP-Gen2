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

// 占領範囲：オブジェクト中心を基準にした「固定サイズの正方形」（旧版準拠）。
// 本部=15×15 / 旗=7×7（タイル数）。STATUE は旧版に定義なし（要確認）。
export const TERRITORY_SIZE: Partial<Record<ObjectType, number>> = {
  HQ: 15,
  FLAG: 7,
};

export function territorySize(type: ObjectType): number {
  return TERRITORY_SIZE[type] ?? 0;
}

export interface Footprint {
  type: ObjectType;
  anchorX: number;
  anchorY: number;
  w: number;
  h: number;
}

// 占領範囲のグリッド線座標ボックス（無ければ null）。中心基準・floor丸め（旧版準拠）。
export function territoryBox(
  o: Footprint
): { x0: number; y0: number; x1: number; y1: number } | null {
  const n = territorySize(o.type);
  if (!n) return null;
  const cx = o.anchorX + o.w / 2;
  const cy = o.anchorY + o.h / 2;
  const x0 = Math.floor(cx - n / 2);
  const y0 = Math.floor(cy - n / 2);
  return { x0, y0, x1: x0 + n, y1: y0 + n };
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
