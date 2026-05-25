# tasks.md — 実装タスクチェックリスト

最終更新: 2026-05-18

各タスクは `- [ ]`(未着手)/ `- [x]`(完了)で表示する。
フェーズ番号 [P1]〜[P9] と、横断タスク [CC] を付ける。

**ステータス**: MVP 完了(Phase 1〜9 すべて完了)。残作業は `README.md` の §14
(今後の保留項目)を参照。

---

## Phase 1 — プロジェクト土台 [P1]

- [x] [P1] パッケージマネージャを決定し `package.json` 初期化
- [x] [P1] Next.js 14+ App Router 構成で `create-next-app` 実行
- [x] [P1] TypeScript strict 設定
- [x] [P1] Tailwind CSS 導入、`tailwind.config.ts` にカラートークン定義(spec.md §7参照)
- [x] [P1] `next/font` で Noto Sans JP 設定
- [x] [P1] ESLint + Prettier 設定、`.editorconfig` 追加
- [x] [P1] `.env.example` 作成(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL` など)
- [x] [P1] `.gitignore` に `.env*`、`.next`、`node_modules` を追加
- [x] [P1] ディレクトリ作成: `app/ components/ lib/ lib/supabase/ lib/stripe/ types/`
- [x] [P1] `app/layout.tsx` でルートレイアウト(html lang="ja", フォント適用)
- [x] [P1] `app/page.tsx` でプレースホルダー
- [x] [P1] shadcn/ui 初期化、Button・Card・Input・Tabs を導入
- [x] [P1] `pnpm dev` でローカル起動確認
- [x] [P1] README.md 雛形作成

## Phase 2 — DB設計とRLS [P2]

- [x] [P2] Supabase プロジェクト作成(本人作業の前提)
- [x] [P2] `supabase` CLI 導入、`supabase init`
- [x] [P2] マイグレーション: `profiles`(id=auth.users参照, display_name, avatar_url, is_creator, is_admin, created_at, updated_at)
- [x] [P2] マイグレーション: `works`(id, creator_id, title, description, category, tags[], system, players, playtime, format, cover_path, file_path, price_jpy, allow_commercial, allow_redistribution, status, published_at, created_at, updated_at)
- [x] [P2] マイグレーション: `orders`(id, user_id, work_id, stripe_session_id UNIQUE, amount_jpy, status, paid_at, refunded_at, created_at)
- [x] [P2] マイグレーション: `admin_audit_logs`(id, admin_id, target_type, target_id, action, payload jsonb, created_at)
- [x] [P2] インデックス: `works(status, published_at)`, `works(category)`, `orders(user_id, status)`, `orders(work_id, status)`
- [x] [P2] RLS有効化(全テーブル)
- [x] [P2] RLSポリシー: `profiles` 自分のみ読み書き(adminは全件)
- [x] [P2] RLSポリシー: `works` 公開作品は誰でもselect、creatorは自作のCRUD、adminは全権
- [x] [P2] RLSポリシー: `orders` 自分の注文のみselect、サーバー(service_role)のみinsert/update
- [x] [P2] RLSポリシー: `admin_audit_logs` adminのみread、サーバーのみwrite
- [x] [P2] Storage バケット作成: `covers`(public read)、`works`(private)
- [x] [P2] Storage RLS: `covers` write は creator 自身のみ、`works` write は creator 自身のみ・read はサーバー経由のみ
- [x] [P2] `lib/supabase/client.ts`(ブラウザ)実装
- [x] [P2] `lib/supabase/server.ts`(SSR、Cookieセッション)実装
- [x] [P2] `lib/supabase/admin.ts`(service_role、サーバー専用)実装、ファイル冒頭に `import 'server-only'`
- [x] [P2] `types/database.ts` を `supabase gen types typescript` で自動生成
- [x] [P2] RLS動作検証SQL(非ログイン / ログインユーザー / 別ユーザー / admin 各ロールで CRUD試験)
- [x] [P2] `service_role` のクライアントバンドル混入チェック(grep + ビルド出力確認)

## Phase 3 — 認証 [P3]

- [x] [P3] `middleware.ts`(Supabase セッションリフレッシュ)
- [x] [P3] `app/signup/page.tsx`(email + password、zod)
- [x] [P3] `app/login/page.tsx`
- [x] [P3] `app/auth/callback/route.ts`(メール確認 + OAuth callback 共用)
- [x] [P3] `app/forgot-password/page.tsx`、`app/reset-password/page.tsx`
- [x] [P3] `lib/auth.ts`: `getUser()`, `requireUser()`, `requireCreator()`, `requireAdmin()`
- [x] [P3] `profiles` 行の自動作成(Supabase trigger or signup後Server Action)
- [x] [P3] サインアウトボタン(ヘッダー)
- [x] [P3] 保護ルートの動作確認

## Phase 4 — ストア一覧・詳細 [P4]

- [x] [P4] `lib/queries/works.ts`: `listPublishedWorks({ category, q, page })`, `getWorkById(id)`
- [x] [P4] `components/store/CategoryTabs.tsx`
- [x] [P4] `components/store/SearchBar.tsx`
- [x] [P4] `components/store/WorkCard.tsx`(表紙、バッジ、価格、メタ)
- [x] [P4] `app/store/page.tsx`(ISR revalidate=60)
- [x] [P4] `app/store/[workId]/page.tsx`(詳細、メタテーブル、作者カード)
- [x] [P4] 「今すぐ購入」ボタンのスタブ(Phase 7で結線)
- [x] [P4] seed データ投入用 SQL(5〜10件)
- [x] [P4] 価格表示ユーティリティ(`formatJpy`)
- [x] [P4] パンくず(ホーム > カテゴリ > 作品名)

## Phase 5 — クリエイター用ビルダー [P5]

- [x] [P5] `app/(app)/creator/layout.tsx`(左サイドバー、`requireCreator`)
- [x] [P5] `app/(app)/creator/page.tsx`(累計売上 + 累計DL のみ)
- [x] [P5] `app/(app)/creator/products/page.tsx`(自作一覧、下書き/公開フィルタ)
- [x] [P5] zod スキーマ: `workInputSchema`(必須/任意項目を分離)
- [x] [P5] `app/(app)/creator/products/new/page.tsx` ビルダー(react-hook-form + zodResolver)
- [x] [P5] `app/(app)/creator/products/[productId]/edit/page.tsx` 編集ビルダー(自作のみ)
- [x] [P5] 左コンテンツツリー(セクションリンク、IntersectionObserverでハイライト)
- [x] [P5] 概要セクション(タイトル、種類カード選択、説明、カテゴリ、対応システム、タグ)
- [x] [P5] 価格セクション(無料/有料切替、¥100〜¥10,000,000バリデーション)
- [x] [P5] ファイル形式選択(PDF / 画像ZIP / 音声)
- [x] [P5] 表紙画像アップロード(署名URL、ドラッグ&ドロップ、推奨1280×720)
- [x] [P5] 作品ファイルアップロード(署名URL、サイズ上限警告)
- [x] [P5] 自動保存(debounce 2秒、Server Action、`updated_at` 更新)
- [x] [P5] 右パネル: プレビューカード、公開ステータス、保存状態、入力チェック件数
- [x] [P5] 公開設定モーダル(公開日時、即時公開)
- [x] [P5] 「作品を作成」=`status='published'` 更新
- [x] [P5] 編集時に他人の作品が開けないこと(RLS + サーバー側ガード)を確認

## Phase 6 — ライブラリ [P6]

- [x] [P6] `app/library/page.tsx`(購入済み一覧、`orders.status='paid'`)
- [x] [P6] `app/library/[workId]/page.tsx`(ダウンロード画面)
- [x] [P6] `app/api/library/[workId]/download/route.ts`: 購入確認→Storageの署名URL(5分)を返却
- [x] [P6] 販売停止作品の表示(DLボタン無効化)
- [x] [P6] 未購入アクセス試験(403確認)

## Phase 7 — Stripe決済 [P7]

- [x] [P7] `lib/stripe/client.ts`(API key 読み込み、Stripe SDK 初期化)
- [x] [P7] `app/api/checkout/route.ts`(`requireUser` → Checkout Session作成、`metadata: workId, userId`、success/cancel URL設定)
- [x] [P7] 「今すぐ購入」ボタン → fetch `/api/checkout` → Stripe Hosted Page
- [x] [P7] `app/api/stripe/webhook/route.ts`(raw body取得、`stripe.webhooks.constructEvent` で署名検証)
- [x] [P7] Webhook ハンドラ: `checkout.session.completed` → `orders` upsert(`stripe_session_id` UNIQUEで冪等)
- [x] [P7] Webhook ハンドラ: `charge.refunded` → `orders.status='refunded'`(MVP最小実装)
- [x] [P7] `app/checkout/success/page.tsx`、`app/checkout/cancel/page.tsx`
- [x] [P7] `stripe listen --forward-to localhost:3000/api/stripe/webhook` でローカル疎通
- [x] [P7] 二重Webhook送信の冪等性試験

## Phase 8 — admin最低機能 [P8]

- [x] [P8] `app/admin/layout.tsx`(`requireAdmin`)
- [x] [P8] `app/admin/page.tsx`(統計サマリ: ユーザー数、公開作品数、累計売上)
- [x] [P8] `app/admin/users/page.tsx`(検索、creator付与/剥奪、停止)
- [x] [P8] `app/(app)/admin/products/page.tsx`(検索、`suspended` 切替)
- [x] [P8] `app/admin/orders/page.tsx`(検索、Stripeダッシュボードへの外部リンク)
- [x] [P8] 全操作で `admin_audit_logs` に追記する Server Action ラッパ

## Phase 9 — テスト・セキュリティ・README整備 [P9]

- [x] [P9] vitest 導入、`lib/auth.ts` のテスト
- [x] [P9] zod スキーマのテスト(`workInputSchema` 異常系)
- [x] [P9] Webhook ハンドラのテスト(署名なし → reject、二重送信 → 1回のみ反映)
- [x] [P9] **手動セキュリティチェックリスト**:
  - [x] 未ログインで `/library`, `/creator`, `/admin` にアクセス → ログインへ
  - [x] user権限で `/admin` にアクセス → 403
  - [x] user権限で `/creator` にアクセス → 403(creator未付与時)
  - [x] creator権限で他人の作品を編集 → RLSで拒否
  - [x] 未購入で署名URL発行API → 403
  - [x] 期限切れ署名URLでDL試行 → 拒否
  - [x] Webhook署名なし送信 → 401
  - [x] `next build` 後の `.next/static` を `grep service_role` → 0件
  - [x] `next build` 後の `.next/static` を `grep STRIPE_SECRET` → 0件
- [x] [P9] README完成(セットアップ、env、Supabase初期化、Stripe Webhook疎通、デプロイ手順)
- [x] [P9] Vercelデプロイ設定確認(環境変数、ビルドコマンド)

## 横断タスク [CC]

- [x] [CC] エラーバウンダリ(`app/error.tsx`, `app/not-found.tsx`)
- [x] [CC] ローディング(`app/loading.tsx`)
- [x] [CC] Toast/通知の共通コンポーネント(shadcn の `sonner`)
- [x] [CC] ヘッダーコンポーネント(検索バー、ナビ、ユーザーメニュー)
- [x] [CC] フッターコンポーネント(最低限)

---

## 注意: このファイルは MVP 実装フェーズの記録

Phase 1〜9 の全タスクは完了済み。以降は **このファイルを編集しないでください**。

- α版受け入れ時の手動チェック → [ACCEPTANCE.md](ACCEPTANCE.md)
- P2 以降のタスク管理 → [decisions.md §7 P2 Backlog](decisions.md)

新規スコープを追加するときは、まず [decisions.md §7](decisions.md) で経緯を確認し、
そこに新項目を起こしてから別ファイルに移してください。
