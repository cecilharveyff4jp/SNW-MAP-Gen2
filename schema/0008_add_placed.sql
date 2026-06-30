-- オブジェクトに「配置済みフラグ」を追加（1=配置済み, 0=未配置プール）。
-- 既存データはすべて 1（配置済み）になる。未配置にしてもデータは保持される。
ALTER TABLE objects ADD COLUMN placed INTEGER NOT NULL DEFAULT 1;
