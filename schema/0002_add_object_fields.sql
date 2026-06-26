-- 既存の objects テーブルに項目を追加するマイグレーション（1回だけ実行）。
-- 新規DBは 0001 に同じ列が含まれるので、このファイルは不要。
-- 適用: npm run migrate2:remote / migrate2:local
-- ※ 1回だけ。2回目は "duplicate column" エラーになる（適用済みの印）。
ALTER TABLE objects ADD COLUMN member_name TEXT;
ALTER TABLE objects ADD COLUMN game_id TEXT;
ALTER TABLE objects ADD COLUMN fc_level TEXT;
ALTER TABLE objects ADD COLUMN note TEXT;
ALTER TABLE objects ADD COLUMN birthday TEXT;
