-- 都市オブジェクトに「戦力」列を追加（任意・整数）。既存データは保持される。
ALTER TABLE objects ADD COLUMN power INTEGER;
