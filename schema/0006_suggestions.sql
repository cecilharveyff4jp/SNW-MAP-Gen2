-- 変更提案（利用者→編集者）。適用: wrangler d1 execute snw-map-gen2 --remote --file=./schema/0006_suggestions.sql
CREATE TABLE IF NOT EXISTS suggestions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id      INTEGER,
  map_id         INTEGER,
  object_label   TEXT,
  field          TEXT NOT NULL,        -- birthday | fc_level | note | position | name | other
  value          TEXT,                 -- 提案する新しい値
  comment        TEXT,                 -- コメント
  proposer_email TEXT,
  proposer_name  TEXT,
  status         TEXT NOT NULL DEFAULT 'open',  -- open | done | rejected
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
