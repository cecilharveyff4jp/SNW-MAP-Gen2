-- SNW-MAP-Gen2 初期スキーマ (Cloudflare D1 / SQLite)
-- 適用: npm run db:local  /  npm run db:remote

-- メタ情報（疎通確認・バージョン管理用）
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '2');

-- マップ（同盟内マップの各シート相当）
CREATE TABLE IF NOT EXISTS maps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  is_visible INTEGER NOT NULL DEFAULT 1,
  is_base    INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- デフォルトマップ（id=1）。新規オブジェクトは未指定ならこのマップに入る。
INSERT OR IGNORE INTO maps (id, name, is_base) VALUES (1, 'メインマップ', 1);

-- マップ上のオブジェクト（HQ/CITY/STATUE/DEPOT/BEAR_TRAP/MOUNTAIN/LAKE/FLAG 等）
--
-- ★座標モデル（確定仕様 / ホワイトアウトサバイバル準拠）★
--   anchor_x, anchor_y : ゲームでタイルをタップして読んだ座標そのもの。
--                        フットプリントのうち「最小X・最小Yの角タイル」を指す（アンカー）。
--   w, h               : フットプリントのタイル数（幅×高さ）。
--   占有タイル          : x in [anchor_x .. anchor_x + w - 1]
--                        y in [anchor_y .. anchor_y + h - 1]
--   描画               : 上記タイル格子を 2:1 アイソメ投影し、X軸で反転して表示
--                        （北の角が下、Xが右下・Yが左下に伸びる）。
--   ※精度はこの格子モデルだけで決まる。回転・反転は見た目の変換にすぎない。
CREATE TABLE IF NOT EXISTS objects (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  map_id    INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  type      TEXT NOT NULL,
  anchor_x  INTEGER NOT NULL DEFAULT 0,   -- ゲーム座標X（最小X角タイル）
  anchor_y  INTEGER NOT NULL DEFAULT 0,   -- ゲーム座標Y（最小Y角タイル）
  w         INTEGER NOT NULL DEFAULT 1,   -- フットプリント幅（タイル数）
  h         INTEGER NOT NULL DEFAULT 1,   -- フットプリント高さ（タイル数）
  label       TEXT,
  member_name TEXT,                       -- メンバー名 / プレイヤー名
  game_id     TEXT,                       -- ゲーム内ID（都市向け・任意）
  fc_level    INTEGER,                    -- FCレベル（火力, 1〜30・任意）
  note        TEXT,                       -- メモ・備考
  birthday    TEXT,                       -- 誕生日（「3月15日」表記・任意）
  animation   TEXT,
  meta_json   TEXT                        -- 拡張用の自由項目（JSON文字列）
);
CREATE INDEX IF NOT EXISTS idx_objects_map ON objects(map_id);

-- ユーザー（編集権限の承認管理）
--   status : pending（申請中） / approved（承認） / rejected（却下）
--   role   : owner（管理者） / editor（編集者）
--   ※オーナー判定は本番では OWNER_EMAIL（Pages secret）と Access 認証メールで行う。
--     このテーブルは申請者と承認状態を保持する。
CREATE TABLE IF NOT EXISTS users (
  email        TEXT PRIMARY KEY,
  display_name TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  role         TEXT NOT NULL DEFAULT 'editor',
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at   TEXT,
  decided_by   TEXT
);
