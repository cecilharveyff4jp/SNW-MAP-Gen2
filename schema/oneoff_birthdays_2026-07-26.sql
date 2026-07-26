-- 旧マップ(スプシ)から誕生日を移行するワンオフ更新（名前照合ベース）。2026-07-26
-- 実行: npx wrangler d1 execute snw-map-gen2 --remote --file=./schema/oneoff_birthdays_2026-07-26.sql
-- 安全策1: 既に誕生日が入っている行は上書きしない（IS NULL OR '' のときだけ更新）。
-- 安全策2: 各UPDATEの直後に、実際に更新された時だけ操作ログ(audit_log)へ1行記録する（changes()>0）。
--          actor は '移行(スプレッドシート)'。detail に「移行元の旧名」も残す。オーナー専用の操作履歴画面に出ます。

-- ① 名前一致（誕生日が空）
UPDATE objects SET birthday='4月21日'  WHERE id=81  AND (birthday IS NULL OR birthday='');
INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail)
  SELECT '移行(スプレッドシート)','update','object','81','あいずみ','{"誕生日":[null,"4月21日"],"移行元":"あいずみ"}' WHERE changes()>0;

UPDATE objects SET birthday='4月13日'  WHERE id=771 AND (birthday IS NULL OR birthday='');
INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail)
  SELECT '移行(スプレッドシート)','update','object','771','とまりん','{"誕生日":[null,"4月13日"],"移行元":"とまりん"}' WHERE changes()>0;

UPDATE objects SET birthday='10月24日' WHERE id=767 AND (birthday IS NULL OR birthday='');
INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail)
  SELECT '移行(スプレッドシート)','update','object','767','ゆうご太郎','{"誕生日":[null,"10月24日"],"移行元":"ゆうご太郎"}' WHERE changes()>0;

UPDATE objects SET birthday='7月11日'  WHERE id=772 AND (birthday IS NULL OR birthday='');
INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail)
  SELECT '移行(スプレッドシート)','update','object','772','SNOW','{"誕生日":[null,"7月11日"],"移行元":"SNOW"}' WHERE changes()>0;

UPDATE objects SET birthday='8月4日'   WHERE id=781 AND (birthday IS NULL OR birthday='');
INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail)
  SELECT '移行(スプレッドシート)','update','object','781','むらさめ','{"誕生日":[null,"8月4日"],"移行元":"むらさめ"}' WHERE changes()>0;

UPDATE objects SET birthday='6月7日'   WHERE id=777 AND (birthday IS NULL OR birthday='');
INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail)
  SELECT '移行(スプレッドシート)','update','object','777','わのひろ','{"誕生日":[null,"6月7日"],"移行元":"わのひろ"}' WHERE changes()>0;

UPDATE objects SET birthday='5月19日'  WHERE id=779 AND (birthday IS NULL OR birthday='');
INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail)
  SELECT '移行(スプレッドシート)','update','object','779','omi','{"誕生日":[null,"5月19日"],"移行元":"omi"}' WHERE changes()>0;

UPDATE objects SET birthday='2月14日'  WHERE id=43  AND (birthday IS NULL OR birthday='');
INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail)
  SELECT '移行(スプレッドシート)','update','object','43','ﾏﾙｺｽ','{"誕生日":[null,"2月14日"],"移行元":"マルコス"}' WHERE changes()>0;

-- ② 改名とみられる
UPDATE objects SET birthday='12月19日' WHERE id=775 AND (birthday IS NULL OR birthday='');
INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail)
  SELECT '移行(スプレッドシート)','update','object','775','ｾｼﾙ','{"誕生日":[null,"12月19日"],"移行元":"セシルん"}' WHERE changes()>0;

UPDATE objects SET birthday='10月4日'  WHERE id=794 AND (birthday IS NULL OR birthday='');
INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail)
  SELECT '移行(スプレッドシート)','update','object','794','元祖ぼぶ','{"誕生日":[null,"10月4日"],"移行元":"ぼぶ"}' WHERE changes()>0;

UPDATE objects SET birthday='1月10日'  WHERE id=768 AND (birthday IS NULL OR birthday='');
INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail)
  SELECT '移行(スプレッドシート)','update','object','768','てんてん™','{"誕生日":[null,"1月10日"],"移行元":"てんてんᵇᵃʷ"}' WHERE changes()>0;

UPDATE objects SET birthday='7月13日'  WHERE id=789 AND (birthday IS NULL OR birthday='');
INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail)
  SELECT '移行(スプレッドシート)','update','object','789','最強のﾍﾑﾀｲ爆誕','{"誕生日":[null,"7月13日"],"移行元":"Riki"}' WHERE changes()>0;

UPDATE objects SET birthday='1月5日'   WHERE id=770 AND (birthday IS NULL OR birthday='');
INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail)
  SELECT '移行(スプレッドシート)','update','object','770','さんぴん茶','{"誕生日":[null,"1月5日"],"移行元":"ぶくぶく茶"}' WHERE changes()>0;

UPDATE objects SET birthday='3月18日'  WHERE id=54  AND (birthday IS NULL OR birthday='');
INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail)
  SELECT '移行(スプレッドシート)','update','object','54','ﾊｹﾞ茶','{"誕生日":[null,"3月18日"],"移行元":"まるも"}' WHERE changes()>0;

UPDATE objects SET birthday='3月18日'  WHERE id=773 AND (birthday IS NULL OR birthday='');
INSERT INTO audit_log (actor_email, action, entity, entity_id, label, detail)
  SELECT '移行(スプレッドシート)','update','object','773','ﾊｹﾞたん','{"誕生日":[null,"3月18日"],"移行元":"まるも（ﾊｹﾞ茶と同一人物）"}' WHERE changes()>0;

-- ③ 別名で移行済み＝対応不要: RedFight(#47) / mǐa(#45) / るいたん(#38) / Lūna(#39) / ちょこさん(ちょこほりっく#51)
-- ④ 手動対象は無視で確定（yuuka/優花・つむぎ・まぁちゃん・Mic・ミクコ・coriki・しゅてん・gift・sign・め-ぷる）
