-- 監査ログ（操作履歴）。誰がいつ何をしたかを残す。
-- entity: object / map / user、action: create / update / delete / place / unplace / rename / copy / approve / reject
-- detail: 変更差分などのJSON文字列（任意）
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  actor_email TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  label TEXT,
  detail TEXT,
  tenant_id INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log (ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity, entity_id);
