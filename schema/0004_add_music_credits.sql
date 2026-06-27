-- 音楽に作詞・作曲／制作者の列を追加（既存DBに1回だけ適用）。
-- 適用: wrangler d1 execute snw-map-gen2 --remote --file=./schema/0004_add_music_credits.sql
ALTER TABLE music ADD COLUMN composer TEXT;
ALTER TABLE music ADD COLUMN producer TEXT;
