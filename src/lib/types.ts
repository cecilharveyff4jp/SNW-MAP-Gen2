// マップ上のオブジェクト。座標モデルはホワイトアウトサバイバル準拠。
//   anchorX / anchorY : ゲームでタイルをタップして読んだ座標（最小X・最小Yの角タイル）
//   w / h             : フットプリントのタイル数
//   占有タイル         : x in [anchorX .. anchorX + w - 1], y in [anchorY .. anchorY + h - 1]
export type ObjectType =
  | "HQ"
  | "CITY"
  | "STATUE"
  | "DEPOT"
  | "BEAR_TRAP"
  | "MOUNTAIN"
  | "LAKE"
  | "FLAG";

export interface MapObject {
  id?: number;
  mapId?: number;
  type: ObjectType;
  anchorX: number;
  anchorY: number;
  w: number;
  h: number;
  label?: string;
}
