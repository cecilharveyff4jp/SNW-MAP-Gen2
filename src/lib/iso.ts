// アイソメ投影（2:1）＋ X軸反転。
// ゲーム画面の見た目に合わせる：北の角が下、X が右下・Y が左下に伸びる。
//
// 投影式（グリッド座標 (gx, gy) → 画面ローカル座標）:
//   sx = (gx - gy) * TILE_HW
//   sy = -(gx + gy) * TILE_HH      ← マイナスで X軸反転（北が下）
// ここで返すのは原点・スケール適用前のローカル座標。実際の配置時に
// 平行移動とズームを掛ける（MapCanvas 側で bounding box にフィット）。

import type { MapObject } from "./types";

export const TILE_HW = 26; // タイル半幅
export const TILE_HH = 13; // タイル半高（2:1）

export interface Point {
  x: number;
  y: number;
}

/** グリッド座標 → 画面ローカル座標（オフセット・ズーム前） */
export function project(gx: number, gy: number): Point {
  return {
    x: (gx - gy) * TILE_HW,
    y: -(gx + gy) * TILE_HH,
  };
}

/**
 * オブジェクトのフットプリント四隅（グリッド線座標）。
 * タイル (anchorX, anchorY) は grid line anchorX..anchorX+1 を占めるので、
 * 範囲は anchorX..anchorX+w / anchorY..anchorY+h。
 */
export function footprintCorners(o: MapObject): Point[] {
  const { anchorX: ax, anchorY: ay, w, h } = o;
  return [
    project(ax, ay),
    project(ax + w, ay),
    project(ax + w, ay + h),
    project(ax, ay + h),
  ];
}

/** フットプリント中心（ラベル配置用、グリッド線座標の中心を投影） */
export function footprintCenter(o: MapObject): Point {
  return project(o.anchorX + o.w / 2, o.anchorY + o.h / 2);
}

/** アンカータイルの中心（★ 表示用） */
export function anchorCenter(o: MapObject): Point {
  return project(o.anchorX + 0.5, o.anchorY + 0.5);
}
