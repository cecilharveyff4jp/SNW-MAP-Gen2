# 熊罠 都市配置シミュレーション ＋ アンケート ─ 実装仕様書

- 対象アプリ: SNW-MAP-Gen2（Cloudflare Pages + Functions + D1 / Vite + React）
- 版: v1.0（2026-07-31 確定）
- デプロイ手順（確定）: `npm run build` → `git add -A && git commit` → `git push` → `npx wrangler pages deploy dist --project-name=snw-map-gen2`

---

## 1. 目的

新しいゲームマップでの都市配置を、メンバーの「熊罠アンケート」の希望に沿って**自動で仮置き**する。熊罠の近くは**総力（power）の高い順**に詰める。役職者が仮マップ上で手直しし、決定したら本メインマップへ反映する。

## 2. 用語

- **熊罠 (BEAR_TRAP)**: 集結拠点。本番DBの実オブジェクト名は「熊罠1[22時]」「熊罠2[21時]」。
- **仮マップ**: メインをコピーして作る配置検討用マップ。
- **cityKey**: 都市（メンバー）を横断的に同定するキー。`game_id → member_name → label` の優先順で決定（全処理で同一ヘルパーを使用）。

## 3. 確定した設計判断

| 論点 | 決定 | 補足 |
|---|---|---|
| テリトリー | **持たない（v1）** | 領地内/外の判定・表示は作らない。障害物回避＋罠最近傍詰めのみ。将来v2で追加余地。 |
| 希望データの保存先 | **メンバー紐づけの独立テーブル** | objectsに列を足さない。将来ほかのアンケートも作れる汎用エンジンにする。 |
| 回答の開放度 | **完全公開（合言葉なし）** | `POST /api/survey` は編集権限不要。同盟内前提で実害小。 |
| 決定→メイン反映 | **座標だけ書き戻し** | is_base昇格ではなく、メインの各都市のanchorのみ更新。 |
| 動かす対象 | **都市のみ** | 旗・資材・建築・地形・熊罠は障害物として固定（熊罠は必要なら手動移動可）。 |

## 4. 既存実装の前提（調査済み）

- `objects` 列: `type, anchor_x, anchor_y, w, h, label, member_name, game_id, fc_level, power, placed, note, birthday, music_ids, animation, meta_json`。
- **座標モデル**: 実ゲーム座標のアンカー方式。占有タイル = `x∈[anchor_x, anchor_x+w-1], y∈[anchor_y, anchor_y+h-1]`。
- 総力 = `objects.power`（最新値。履歴は `power_history`）。在/不在 = `placed`（1/0）。
- 書き込みAPIは `/api/admin/*`（`requireEditor` 認証、`_shared` の `writeAudit / diffObject / validateBody` を利用）。読み取り（`/api/objects?map=<id>` 等）は公開。
- マップ複製: `functions/api/admin/maps.ts` の `createMap(name, copyFrom)` が `INSERT … SELECT` の列明示コピー（animation / meta_json は非コピー）。
- メインマップ = id 1（is_base）。

## 5. データモデル（新規 migration `schema/0011_add_surveys.sql`）

```sql
CREATE TABLE IF NOT EXISTS surveys (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  skey        TEXT NOT NULL UNIQUE,        -- 'trap_placement'
  title       TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 0,  -- 募集中フラグ
  options_json TEXT,                       -- [{"value":"p1","label":"熊罠1[22時]"}, ...]
  map_id      INTEGER,                     -- 対象マップ（基本はメイン=1）
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS survey_answers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id  INTEGER NOT NULL,
  member_key TEXT NOT NULL,                -- cityKey
  value      TEXT NOT NULL,                -- 'p1' | 'p2' | 'both' | 'any'
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(survey_id, member_key)
);
CREATE INDEX IF NOT EXISTS idx_survey_answers ON survey_answers(survey_id);

-- seed: trap_placement を1件（options_json の熊罠ラベルは実オブジェクト名を入れる）
INSERT OR IGNORE INTO surveys (skey, title, active, options_json, map_id)
VALUES ('trap_placement', '新マップ 配置アンケート', 0,
  '[{"value":"p1","label":"熊罠1[22時]"},{"value":"p2","label":"熊罠2[21時]"},{"value":"both","label":"どちらにも近い"},{"value":"any","label":"こだわらない"}]',
  1);
```

> 希望はこのテーブルに独立して持つため、**objects とコピー処理は変更不要**。自動配置時に「仮マップの CITY × survey_answers」を `cityKey` で join して希望を得る。コピー/再コピーに勝手に追従する。

## 6. API 仕様

### 公開（認証なし）
- `GET /api/survey?key=trap_placement`
  - 返却: `{ active, title, options:[{value,label}], answers: { [memberKey]: value }, counts: { p1, p2, both, any } }`
  - 用途: メンバーUIのプリフィル・集計、役職者の状況把握。
- `POST /api/survey`
  - 本文: `{ key, memberKey, value }`
  - 動作: `survey_answers` を upsert（`ON CONFLICT(survey_id, member_key) DO UPDATE SET value=?, updated_at=…`）。
  - 検証: `value` は survey.options に含まれる値のみ。`active=0` の時は 409（募集終了）。

### 編集者（`requireEditor`）
- `POST /api/admin/survey` … active 切替（最小構成）／必要なら options 編集。監査記録。
- `POST /api/admin/objects/bulk-place`
  - 本文: `{ mapId, placements: [{ id, anchorX, anchorY }] }`
  - 動作: まとめて `UPDATE objects SET anchor_x=?, anchor_y=? WHERE id=? AND map_id=?`。監査1行「自動配置：N都市」。
- `POST /api/admin/objects/apply-layout`
  - 本文: `{ fromMapId }`（toは常にメイン=is_base）
  - 動作: 仮マップの CITY を `cityKey` でメインの同一都市に同定し、anchor のみ UPDATE。監査「配置を本番へ反映：N都市（未一致M）」。
  - 返却: `{ applied, unmatched:[{cityKey,label}] }`（未一致はUIで手当て）。

## 7. cityKey（都市同定キー）

```
cityKey(obj) = obj.game_id?.trim() || obj.member_name?.trim() || obj.label?.trim()
```
- アンケート回答・自動配置・書き戻しのすべてで同一関数を使用。
- 注意: member_name をキーにする場合は**同名がいると曖昧**。game_id があれば最優先。書き戻しの未一致は返却して手当て可能にする。

## 8. 自動配置アルゴリズム（クライアント側・実ゲーム座標）

1. **障害物集合**: 仮マップの非CITYオブジェクト（旗・資材・建築・地形・熊罠）の占有タイルを全て収集。
2. **候補アンカー**: CITY の footprint（`w×h`、通常2×2）が収まり、障害物にも他都市にも重ならない空きアンカーを列挙。
3. **希望取得**: 各 CITY の `cityKey` → `survey_answers.value`。未回答は `any` 扱い。
4. **割当**（`power` 降順）:
   - `p1`/`p2`: 該当 BEAR_TRAP 中心へ最近傍の空きアンカーから詰める。
   - `both`: 2罠への `max(距離)` が最小のアンカー。
   - `any`: 残りを中心寄り／空き優先で充填。
5. 結果を `bulk-place` に送信。描画・ドラッグ手直しは既存機能を流用。

> テリトリーが無いぶん、近傍詰めで自然に罠周りに密集する。座標は実ゲーム座標で出力するのでそのまま本番反映できる。

## 9. 画面 / フロー

### メンバー（アンケート回答・完全公開）
入口は3か所: **案内バー**（募集中のみアプリ上部）／**メニュー**（「配置アンケート」常設）／**自分の都市**（地図でタップ→カードの「熊罠の希望」）。
フロー: いつものアプリを開く → 自分の都市を選ぶ（`snw_my_city` を再利用、初回のみ）→ 4択タップ → `POST /api/survey` 保存 → 集計（counts）表示。回答はいつでも変更可。

### 役職者（シミュレーション）
1. 「配置シミュレーションを作成」→ 既存 `createMap(copyFrom=メイン)` で仮マップ生成（熊罠・旗・資材・建築・地形・都市ごと複製）。
2. 「希望どおり自動配置」→ §8 を実行 → `bulk-place`。
3. ドラッグで手直し（既存）。必要なら熊罠を手動移動して再配置。
4. 「決定してメインへ反映」→ `apply-layout` で座標書き戻し。未一致は一覧提示。

## 10. 権限・監査

- コピー / 自動配置 / bulk-place / apply-layout / active切替 = **editor**（`requireEditor`）。
- アンケート回答 = **公開**。
- 変更は既存 `writeAudit` で監査ログに記録（自動配置・本番反映はサマリ1行）。

## 11. 実装フェーズ

- **Phase A（希望を集める）**: migration 0011 ＋ `/api/survey`（公開GET/POST）＋ アンケートUI（3入口・都市選択・4択・集計）＋ active 切替。※単体で価値。
- **Phase B（並べる）**: 自動配置ロジック ＋ `bulk-place` ＋ 仮マップ作成導線 ＋「希望どおり自動配置」ボタン ＋ 手直し。
- **Phase C（反映する）**: `apply-layout`（座標書き戻し・未一致ハンドリング）＋ 仕上げ。

## 12. リスク・留意点・将来拡張

- **同定キーの曖昧さ**: member_name 同名。game_id 優先＋未一致提示で吸収。
- **公開POSTの濫用**: 同盟内前提で許容。将来 active 期間・簡易レート制限で強化可。
- **v2 拡張余地**: テリトリー（旗からの領地計算・領地内優先＋領地外は非推奨マーク）、熊罠位置の最適化比較、別種アンケート（surveys テーブルは汎用設計済み）。

## 13. 参照（合意済みモック）

- メンバー回答フロー: `survey_member_flow_mock.html`
- 役職者配置（実データ名・実総力68都市）: `trap_placement_leader_mock.html`
