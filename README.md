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

## デプロイ（概要）

1. Cloudflare で D1 データベースを作成し、`wrangler.toml` の `database_id` を設定
2. `npm run db:remote` で本番 D1 にスキーマ適用
3. Cloudflare Pages にリポジトリを接続（ビルドコマンド `npm run build` / 出力 `dist`）

## ライセンス / 運用メモ

個人運用のホビープロジェクト。
