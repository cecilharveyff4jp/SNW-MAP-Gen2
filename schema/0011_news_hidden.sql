-- ニュースの非表示（操作ミス等で出た自動ニュースを編集者が消す＝全員から隠す）。
-- ニュースは audit_log からの派生ビューなので、隠したい audit_log.id をここに記録して除外する。
CREATE TABLE IF NOT EXISTS news_hidden (
  audit_id INTEGER PRIMARY KEY,
  hidden_at TEXT NOT NULL DEFAULT (datetime('now')),
  actor_email TEXT,
  tenant_id INTEGER DEFAULT 1
);
