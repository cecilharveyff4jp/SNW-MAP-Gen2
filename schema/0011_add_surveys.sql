-- アンケート（汎用エンジン）。将来ほかのアンケートも surveys に1行足すだけで作れる。
-- 熊罠配置アンケートが最初の1件。希望は member_key（cityKey: game_id/member_name/label）で保持し、
-- objects からは独立。マップのコピー/再コピーに勝手に追従する。
CREATE TABLE IF NOT EXISTS surveys (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  skey         TEXT NOT NULL UNIQUE,        -- 'trap_placement'
  title        TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 0,  -- 募集中フラグ
  options_json TEXT,                        -- [{"value":"p1","label":"熊罠1[22時]"}, ...]
  map_id       INTEGER,                     -- 対象マップ（基本はメイン=1）
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS survey_answers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id  INTEGER NOT NULL,
  member_key TEXT NOT NULL,                 -- cityKey
  value      TEXT NOT NULL,                 -- 'p1' | 'p2' | 'both' | 'any'
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(survey_id, member_key)
);
CREATE INDEX IF NOT EXISTS idx_survey_answers ON survey_answers(survey_id);

-- seed: 熊罠配置アンケート（ラベルは本番の実オブジェクト名）
INSERT OR IGNORE INTO surveys (skey, title, active, options_json, map_id) VALUES (
  'trap_placement', '新マップ 配置アンケート', 0,
  '[{"value":"p1","label":"熊罠1に近づけたい"},{"value":"p2","label":"熊罠2に近づけたい"},{"value":"both","label":"どちらにも近いと嬉しい"},{"value":"any","label":"こだわらない（お任せ）"}]',
  1
);
