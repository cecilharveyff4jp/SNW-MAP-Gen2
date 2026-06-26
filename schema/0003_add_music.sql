-- 音楽機能の追加（既存DBに1回だけ適用）。
-- 適用: npm run migrate3:remote / migrate3:local
-- ※ music テーブルは IF NOT EXISTS なので冪等。music_ids 列の ALTER は1回のみ。
CREATE TABLE IF NOT EXISTS music (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  url        TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'alliance',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE objects ADD COLUMN music_ids TEXT;
