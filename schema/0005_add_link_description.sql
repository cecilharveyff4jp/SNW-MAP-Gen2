-- リンクに概要説明（description）列を追加（既存DBに1回だけ適用）。
-- 適用: wrangler d1 execute snw-map-gen2 --remote --file=./schema/0005_add_link_description.sql
ALTER TABLE links ADD COLUMN description TEXT;
