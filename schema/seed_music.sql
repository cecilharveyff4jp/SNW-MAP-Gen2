-- 旧アプリから音楽リストを移植（2026-06-27）
-- 再実行で重複しないよう既存musicを全消去してから投入。
-- 適用: wrangler d1 execute snw-map-gen2 --remote --file=./schema/seed_music.sql
DELETE FROM music;
INSERT INTO music (title, url, type, sort_order) VALUES
  ('SVS', 'https://suno.com/song/48b7d3ee-e09c-4a6a-99d8-cbdcf9655b5e?sh=fbLBWbCzKBMmy8sw', 'alliance', 1),
  ('コMの説明書', 'https://suno.com/song/64e06a88-8cbf-4442-998e-51c7129a0f90?sh=P8Sm3mQRWpudUp9l', 'city', 1),
  ('You Go', 'https://suno.com/song/d116e5c8-7949-4f9c-bda4-679c1c968944?sh=iTYmiaTzccUPQRsN', 'city', 2),
  ('Mic〜我らの盟主〜', 'https://suno.com/song/23cf8e08-526b-4449-85e2-2c66c5b7a552?sh=kkB18Q2XBVLhsM5s', 'city', 3),
  ('塩対応で笑ってたい', 'https://suno.com/song/3723f5a6-8e80-4257-9742-fac63ff74ee4?sh=4sSi0kK90MR4EF0A', 'alliance', 4),
  ('ホワサバで暴れる白熊の曲', 'https://suno.com/song/e161c07d-4868-49ee-a1f3-ea2c23c68e50?sh=vWFyMhMlV04rrmFL', 'city', 5),
  ('SNW〜幹部ver.〜', 'https://suno.com/song/6ef8094d-217a-4568-9a5a-0099de983ed9?sh=r7GbskQAj4WQV9KN', 'alliance', 6),
  ('後頭部を狙え！！', 'https://suno.com/song/5eb48490-2705-452e-ae76-c46d3de773cb?sh=LNwLuy12xkw6Yrjo', 'alliance', 7),
  ('我らがセシル', 'https://suno.com/song/93bcb0ea-1123-46a9-a272-eb7b6c1b4138?sh=ikzF7mI0RBBDcMXy', 'city', 8),
  ('We''re all in this together!', 'https://suno.com/song/dd560e3a-964d-4ef0-a2a0-2dda97e4c568?sh=Aj1WeD7OnmO5QJvZ', 'alliance', 10),
  ('寝落ち同盟', 'https://suno.com/song/6fa8f5ec-c926-49f4-85d8-25768fb73c8c?sh=VbnC676uZvM9IOxw', 'alliance', 11),
  ('愛されスノさん', 'https://suno.com/song/f15bf908-052f-4dde-8106-53b6a11b4d5b?sh=sbb30BjgXVnr2MyO', 'city', 12),
  ('Professor!!', 'https://suno.com/song/78651112-6589-4c24-8d23-9ff391687a8e?sh=dcJgCKtpzX6KEJBz', 'city', 13),
  ('ノノノノノフっち', 'https://suno.com/song/ddcd028c-af57-4cc6-8fa2-933eee88d532?sh=N9tqNdRMD4aAnkhW', 'city', 15),
  ('ハルル･インペリアル・マーチ', 'https://suno.com/song/31776a29-6c0b-4d19-b69d-24564a4a3d7e?sh=4aNTSp5GEmYKSVP3', 'city', 16),
  ('りつりつりつき！！', 'https://suno.com/song/238f7601-6075-4d5e-bcbc-3ce08ca4c765?sh=FCrGOpSVzJwTNGAZ', 'city', 17),
  ('Selēnē〜汚部屋の住人たちへ〜', 'https://suno.com/song/8e45b6de-74f1-411b-950d-0f1732b3eb35?sh=iBfeNphv4R0tmIA3', 'alliance', 18),
  ('Esta es maru', 'https://suno.com/song/653e2e3c-1357-4879-b439-cfd81652b474?sh=ruYz6m2361LBNZyk', 'city', 19),
  ('Meghan', 'https://www.youtube.com/watch?v=fD7LIqkKisc&list=RDfD7LIqkKisc&start_radio=1', 'alliance', 98),
  ('FF IV Opening', 'https://youtu.be/VRah-zYboFw?si=oNxg1PDvnEVNMR2k', 'city', 99);
