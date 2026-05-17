# TRPG プラットフォーム

TRPG向け作品マーケットの A版MVP。
クリエイターが作品(シナリオ・ルールブック・マップ・アート・BGM)を販売し、購入者がライブラリからダウンロードする。

詳細仕様は以下を参照:

- [spec.md](./spec.md) — 対象範囲・画面一覧・主要ユースケース
- [plan.md](./plan.md) — フェーズ分割・完了条件
- [tasks.md](./tasks.md) — タスクチェックリスト
- [decisions.md](./decisions.md) — 技術判断・保留事項・前提

## 技術スタック

- Next.js 14+ (App Router) / TypeScript
- Tailwind CSS / shadcn/ui 方式(コピー&所有)
- Supabase(Auth / Postgres / Storage)— Phase 2 以降
- Stripe Checkout — Phase 7 以降
- Vercel(本番) / pnpm(パッケージマネージャ)

## セットアップ(Phase 1 時点)

### 前提

- Node.js 20+
- pnpm 9+(`corepack enable` → `corepack prepare pnpm@latest --activate` または公式手順)

### 手順

```sh
# 1. 依存関係のインストール
pnpm install

# 2. 環境変数の雛形をコピー(Phase 1 時点では空でよい)
cp .env.example .env.local

# 3. 開発サーバー起動
pnpm dev
```

ブラウザで http://localhost:3000 を開くと、トップページが表示される。

### スクリプト

| コマンド | 内容 |
|---|---|
| `pnpm dev` | 開発サーバー起動 |
| `pnpm build` | 本番ビルド |
| `pnpm start` | 本番モード起動 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | tsc --noEmit |
| `pnpm format` | Prettier 整形 |

## 進行中のフェーズ

- [x] **Phase 1** — プロジェクト土台(完了)
- [ ] Phase 2 — DB設計とRLS
- [ ] Phase 3 — 認証
- [ ] Phase 4 — ストア一覧・詳細
- [ ] Phase 5 — クリエイター用ビルダー
- [ ] Phase 6 — ライブラリ
- [ ] Phase 7 — Stripe決済
- [ ] Phase 8 — admin
- [ ] Phase 9 — テスト・セキュリティ・README整備

各フェーズの完了条件は [plan.md](./plan.md) を参照。

## ディレクトリ構成

```
app/                    # App Router
  (public)/             # 認証不要
  (app)/                # 認証必須(Phase 3 以降)
  api/                  # Route Handlers(Phase 2 以降)
components/
  ui/                   # 基本UI(button, card, input, badge)
  layout/               # レイアウト(top-header, sidebar, three-column 等)
lib/
  supabase/             # Supabase クライアント(Phase 2)
  stripe/               # Stripe クライアント(Phase 7)
  queries/              # データ取得(Phase 4)
  validators/           # zod スキーマ(Phase 5)
  utils.ts              # 共通ヘルパ
supabase/migrations/    # SQL マイグレーション(Phase 2)
types/                  # 型定義(Supabase 自動生成含む)
```
