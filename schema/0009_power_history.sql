-- 総力の履歴（追記型）。更新のたびにスナップショットを1行追記する。
-- objects.power は「最新値」として据え置き（地図・ランキングは従来どおり）。
CREATE TABLE IF NOT EXISTS power_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id INTEGER NOT NULL,
  power INTEGER NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')), -- UTC
  source TEXT NOT NULL DEFAULT 'manual',               -- manual / scrcpy など
  note TEXT,
  tenant_id INTEGER NOT NULL DEFAULT 1                  -- 将来のテナント化に備える
);
CREATE INDEX IF NOT EXISTS idx_power_history_obj ON power_history(object_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_power_history_at ON power_history(recorded_at);
