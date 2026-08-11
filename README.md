# SNW-MAP-Gen2

同盟内マップ Web アプリの新世代版。GAS を使わず、Cloudflare 完結の **完全無料** 構成で再構築する。

## 技術スタック

| レイヤ | 採用 | 備考 |
| --- | --- | --- |
| フロント | Vite + React + TypeScript | 静的ビルド |
| ホスティング | Cloudflare Pages | 無料枠 |
| API | Cloudflare Pages Functions (Workers) | `functions/` ディレクトリ |
| DB | Cloudflare D1 (SQLite) | 無料枠 |

すべて Cloudflare 1 アカウントで完結し、追加課金は不要。

## ディレクトリ構成

```
SNW-MAP-Gen2/
├─ src/              フロント (Vite + React)
├─ functions/        Pages Functions (API)
│  └─ api/
├─ schema/           D1 スキーマ / マイグレーション SQL
├─ public/           静的アセット
├─ wrangler.toml     Cloudflare 設定 (D1 バインディング)
├─ vite.config.ts
├─ tsconfig.json
└─ package.json
```

## ローカル開発

```bash
npm install
npm run dev          # Vite 開発サーバ
npm run db:local     # D1 ローカルDBに初期スキーマ適用
npm run pages:dev    # Pages Functions + D1 をローカルで動かす
```

## デプロイ

`main` に push すると GitHub Actions（[.github/workflows/deploy.yml](.github/workflows/deploy.yml)）が
ビルドして Cloudflare Pages へ自動デプロイする。`npm run build` が失敗した場合はデプロイされない。
`.md` と `docs/` のみの変更では発火しない。Actions タブから手動実行も可能。

```bash
git add -A && git commit -m "..." && git push   # これだけで本番反映
```

CI を通さず手元から直接デプロイしたい場合（緊急時など）:

```bash
npm run build
npx wrangler pages deploy dist --project-name=snw-map-gen2
```

### 初期セットアップ（構築済み・再構築時の参考）

1. Cloudflare で D1 データベースを作成し、`wrangler.toml` の `database_id` を設定
2. `npm run db:remote` で本番 D1 にスキーマ適用
3. Cloudflare Pages プロジェクト `snw-map-gen2` を直接アップロード方式で作成
4. GitHub リポジトリの Secrets に `CLOUDFLARE_API_TOKEN`（アカウント → Cloudflare Pages → 編集）と
   `CLOUDFLARE_ACCOUNT_ID` を登録

> Pages のリポジトリ連携（Git 統合）は使っていない。デプロイ経路は上記 Actions と手動 wrangler の2つのみ。

## ライセンス / 運用メモ

個人運用のホビープロジェクト。
