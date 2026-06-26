-- SNW-MAP-Gen2 初期スキーマ (Cloudflare D1 / SQLite)
-- 適用: npm run db:local  /  npm run db:remote

-- メタ情報（疎通確認・バージョン管理用）
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '1');

-- マップ（同盟内マップの各シート相当）
CREATE TABLE IF NOT EXISTS maps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  is_visible INTEGER NOT NULL DEFAULT 1,
  is_base    INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- マップ上のオブジェクト（HQ/CITY/STATUE/DEPOT/BEAR_TRAP/MOUNTAIN/LAKE/FLAG 等）
CREATE TABLE IF NOT EXISTS objects (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  map_id    INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  type      TEXT NOT NULL,
  x         REAL NOT NULL DEFAULT 0,
  y         REAL NOT NULL DEFAULT 0,
  width     REAL,
  height    REAL,
  label     TEXT,
  animation TEXT,
  meta_json TEXT  -- 拡張用の自由項目（JSON文字列）
);
CREATE INDEX IF NOT EXISTS idx_objects_map ON objects(map_id);
