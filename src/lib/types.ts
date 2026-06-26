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
  | "FLAG"
  | "OTHER";

export interface MapObject {
  id?: number;
  mapId?: number;
  type: ObjectType;
  anchorX: number;
  anchorY: number;
  w: number;
  h: number;
  label?: string;
  memberName?: string; // メンバー名 / プレイヤー名
  gameId?: string; // ゲーム内ID（都市向け・任意）
  fcLevel?: string; // FCレベル（"1"〜"30" / "FC1"〜"FC10"・任意）
  note?: string; // メモ・備考
  birthday?: string; // 誕生日（「3月15日」表記・任意）
  musicIds?: number[]; // 紐づけた曲ID
}
