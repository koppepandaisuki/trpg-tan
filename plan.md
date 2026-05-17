# plan.md — 実装フェーズ計画

最終更新: 2026-05-18

---

## 1. フェーズ一覧

| Phase | テーマ | 依存 | 推定 |
|---|---|---|---|
| 1 | プロジェクト土台 | — | 1〜2日 |
| 2 | DB設計とRLS | 1 | 2〜3日 |
| 3 | 認証 | 1, 2 | 2日 |
| 4 | ストア一覧・詳細 | 2, 3 | 3〜4日 |
| 5 | クリエイター用ビルダー | 2, 3 | 4〜6日 |
| 6 | ライブラリ | 2, 3 | 1〜2日 |
| 7 | Stripe決済 | 2, 3, 4 | 3〜4日 |
| 8 | admin最低機能 | 2〜7 | 2日 |
| 9 | テスト・セキュリティ・README整備 | 全 | 2〜3日 |

依存関係:
```
1 → 2 → 3 ─┬→ 4 ─┐
            ├→ 5  ├→ 7 → 8 → 9
            └→ 6 ─┘
```

各フェーズは前フェーズが「完了条件」を満たした後にのみ着手する。
1フェーズ終わるごとに、ユーザーに進捗とサンプル動作を提示して確認を取る。

---

## 2. Phase 1 — プロジェクト土台

### 目的
Next.js 14+ プロジェクトの初期化と、後続フェーズで使う共通基盤(Tailwind, lint, env, ディレクトリ規約)を整える。コードは最小限。

### 成果物
- `package.json`、`tsconfig.json`、`next.config.mjs`
- `tailwind.config.ts`、`postcss.config.js`、`app/globals.css`(Noto Sans JP適用、トークン定義)
- `.env.example`(本物の値は入れない)
- `.gitignore`、`README.md`(雛形のみ)
- 基本ディレクトリ(`app/`, `components/`, `lib/`, `lib/supabase/`, `lib/stripe/`, `types/`)
- `app/layout.tsx`, `app/page.tsx`(プレースホルダー)
- ESLint + Prettier 設定
- shadcn/ui の初期化、Button・Card・Inputの導入(最小限)

### 完了条件
- [ ] `pnpm dev`(または `npm run dev`)でローカル起動し、トップページが表示される
- [ ] `pnpm lint` がエラーなし
- [ ] Tailwindでスタイルが効く
- [ ] `.env.example` が用意され、必要なキー名がリストされている

### 次フェーズ着手前の確認ポイント
- パッケージマネージャ(pnpm / npm / yarn)の選択
- フォント取得方法(Google Fonts CDN / next/font)

---

## 3. Phase 2 — DB設計とRLS

### 目的
Supabaseのテーブル設計、Storage設計、RLSポリシーを確定する。Phase 3以降が安全に乗る土台を作る。

### 成果物
- `supabase/migrations/` 配下のSQLマイグレーション
  - `profiles`, `works`, `orders`, `admin_audit_logs`
- RLSポリシー定義(各テーブル)
- Storageバケット定義(`covers` 公開、`works` 非公開)
- `lib/supabase/client.ts`(ブラウザ用、anonキー)
- `lib/supabase/server.ts`(SSR用、Cookieセッション)
- `lib/supabase/admin.ts`(service_role、Route Handler専用)
- `types/database.ts`(Supabase CLIで自動生成)

### 完了条件
- [ ] マイグレーションが Supabase に適用できる
- [ ] RLS が全テーブルで有効化されている
- [ ] 「自分の作品しか編集できない」「購入していない作品はDLできない」が手動SQLで検証済み
- [ ] service_role が `lib/supabase/admin.ts` 以外で参照されていないことを grep で確認
- [ ] `types/database.ts` が生成されている

### 次フェーズ着手前の確認ポイント
- スキーマレビュー: フィールドの過不足、enum値の妥当性
- インデックスの妥当性

---

## 4. Phase 3 — 認証

### 目的
サインアップ・ログイン・ログアウト・パスワード再設定の最小フロー。サーバー/クライアント双方でセッションを取れる仕組み。

### 成果物
- `app/login/page.tsx`、`app/signup/page.tsx`、`app/auth/callback/route.ts`
- `app/forgot-password/page.tsx`、`app/reset-password/page.tsx`
- `middleware.ts`(セッションリフレッシュ + 保護ルートのチェック)
- `lib/auth.ts`(`getUser()`, `requireUser()`, `requireCreator()`, `requireAdmin()` ヘルパ)
- 共通レイアウト用の認証コンテキスト

### 完了条件
- [ ] サインアップ → メール確認リンク → ログイン完了 が通る
- [ ] ログアウトでセッションが破棄される
- [ ] 保護ルート(`/library`, `/creator`)が未ログインでログインへリダイレクト
- [ ] RLSが認証セッションを正しく受け取れている(Supabase Studioで確認)

### 次フェーズ着手前の確認ポイント
- パスワードリセットメールテンプレートの文言
- メール確認のドメイン(本番ドメイン or localhost)

---

## 5. Phase 4 — ストア一覧・詳細

### 目的
誰でも閲覧できる作品一覧と詳細画面。「探す」のUX。

### 成果物
- `app/store/page.tsx`(タブ、検索フォーム、グリッド)
- `app/store/[workId]/page.tsx`(詳細、購入導線スタブ)
- `components/store/WorkCard.tsx`、`CategoryTabs.tsx`、`SearchBar.tsx`
- `lib/queries/works.ts`(`listPublishedWorks`, `getWorkById`)
- カテゴリバッジ・価格表示のヘルパ

### 完了条件
- [ ] 公開状態の作品のみが表示される(RLSで担保)
- [ ] カテゴリタブで絞り込みが動く
- [ ] 検索(タイトル前方一致 or 全文検索)が動く
- [ ] 詳細ページでメタ情報が画像3レイアウト通りに表示される
- [ ] ISR(再検証60秒)が効いている

### 次フェーズ着手前の確認ポイント
- ダミーデータ(seed)の準備状況
- 検索を Postgres `ilike` で済ますか、`tsvector` 全文検索にするか

---

## 6. Phase 5 — クリエイター用ビルダー

### 目的
クリエイターが作品を作成・編集・公開できる。画像4のUIに準拠。

### 成果物
- `app/(app)/creator/layout.tsx`(左サイドバー含む)
- `app/(app)/creator/products/new/page.tsx`、`[productId]/edit/page.tsx`
- ビルダーフォーム(react-hook-form + zod)
  - 概要 / 基本情報 / 本文・詳細 / タグ・カテゴリ / 価格設定 / 公開設定 / ファイル添付
- 自動保存(debounce 2秒、Server Action)
- 表紙画像 / 作品ファイル アップロード(署名URL経由)
- 右パネル: ライブプレビュー + 公開ステータス + 保存状態 + 入力チェック
- 「作品を作成」ボタン(公開トグル)

### 完了条件
- [ ] 下書き保存ができる(`status='draft'`)
- [ ] 公開ができる(`status='published'`)
- [ ] 自動保存が動き、画面に「自動保存中 / 数秒前に保存しました」と表示される
- [ ] 必須項目の不足が右パネルに件数として出る
- [ ] 表紙画像と作品ファイルがStorageに保存され、`works.cover_path` / `file_path` に記録される
- [ ] 他人の作品を編集しようとするとRLSで弾かれる

### 次フェーズ着手前の確認ポイント
- ファイルサイズ上限(Supabase Storage の制約、Stripe無関係)
- ZIPの中身チェック(MVPは不要、サイズ制限だけ)

---

## 7. Phase 6 — ライブラリ

### 目的
購入済み作品のみをユーザーが閲覧・ダウンロードできる。

### 成果物
- `app/library/page.tsx`(購入済み一覧)
- `app/library/[workId]/page.tsx`(ダウンロード画面)
- `app/api/library/[workId]/download/route.ts`(購入確認 → 短命署名URL発行)
- `components/library/PurchasedWorkCard.tsx`

### 完了条件
- [ ] `orders.status='paid'` の作品のみ表示
- [ ] ダウンロードリンクは5分以内の署名URL
- [ ] 未購入のworkIdに直接アクセスしてもURL発行されない(API + RLSで二重防御)
- [ ] 取り下げ(`works.status='suspended'`)された作品は「販売停止中」表示、DL不可

### 次フェーズ着手前の確認ポイント
- 「販売停止された作品を購入済みユーザーがDLできるか」のポリシー(MVPはDL不可で進める前提だが要確認)

---

## 8. Phase 7 — Stripe決済

### 目的
作品詳細から購入完了 → ライブラリ反映までを通す。

### 成果物
- `app/api/checkout/route.ts`(Checkout Session 作成、`metadata: { workId, userId }`)
- `app/api/stripe/webhook/route.ts`(署名検証、`checkout.session.completed` を処理、`orders` を作成・更新)
- `app/checkout/success/page.tsx`、`app/checkout/cancel/page.tsx`
- `lib/stripe/client.ts`、`lib/stripe/webhook.ts`
- 「今すぐ購入」ボタンの結線(`/store/[workId]` 詳細から)

### 完了条件
- [ ] テストモードでCheckout成功 → Webhook受信 → `orders.status='paid'` 更新 → ライブラリに表示 が通る
- [ ] 同じ session.id を二重に受け取っても二重決済記録されない(冪等性)
- [ ] 署名検証が失敗するリクエストは401で拒否
- [ ] Stripe Webhookエンドポイントを `stripe listen` でローカル疎通済み

### 次フェーズ着手前の確認ポイント
- 本番Webhookシークレットの管理(Vercel環境変数)
- Stripe Customer Portalの採用可否(MVPは未採用で進める)

---

## 9. Phase 8 — admin最低機能

### 目的
adminが運用初期に最低限必要な操作。豪華なUIは不要。

### 成果物
- `app/admin/layout.tsx`(`requireAdmin` で保護)
- `app/admin/users/page.tsx`(検索 + creator付与/剥奪 + 停止)
- `app/(app)/admin/products/page.tsx`(検索 + 公開停止)
- `app/admin/orders/page.tsx`(検索 + Stripe管理画面リンク)
- 全操作で `admin_audit_logs` に記録

### 完了条件
- [ ] 非adminは `/admin/*` にアクセスできない
- [ ] creator フラグ付与・剥奪が動き、付与されたユーザーが `/creator` を使える
- [ ] 作品の `suspended` 切り替えがストアに反映される
- [ ] 監査ログが記録される

---

## 10. Phase 9 — テスト・セキュリティ・README整備

### 目的
他人がREADMEだけで再現でき、最低限のRLS/Webhook/署名URLが破られないことを確認する。

### 成果物
- `README.md` の実装(セットアップ手順、env一覧、Supabase初期化、Stripe Webhook疎通)
- `vitest` or `node:test` での要所ユニットテスト(zodスキーマ、authヘルパ、Webhook処理)
- 手動セキュリティチェックリスト(後述の `tasks.md` 参照)
- E2Eは見送る(MVPでは過剰投資)

### 完了条件
- [ ] READMEの手順だけで他のPCから起動できる
- [ ] RLSバイパスを試みる手動テストが全てfailする
- [ ] Stripe Webhook署名なしリクエストが拒否される
- [ ] 未購入workのダウンロードAPIが403を返す
- [ ] `service_role` キーがクライアントバンドルに含まれていない(`next build` 後にgrepで確認)
- [ ] ユニットテスト全パス

---

## 11. リスクと緩和策

| リスク | 影響 | 緩和策 |
|---|---|---|
| RLSポリシーの誤りで購入前の作品が漏れる | 重大 | Phase 2終了時に手動SQLで網羅検証、Phase 9でも再検証 |
| service_roleキーの誤露出 | 致命的 | サーバー専用モジュールに分離、grepで自動チェック |
| Stripe Webhookの取りこぼし | 中(購入が反映されない) | 冪等処理 + Stripeダッシュボードでretry可、Phase 9で意図的に重複送信して試験 |
| 自動保存の負荷 | 低〜中 | debounce 2秒、PATCHのみ |
| ファイルサイズ問題 | 中 | Storage設定で上限を明示、ZIP・PDF上限を200MB程度に |

## 12. マイルストーン(目安)

- M1(Phase 1-3完了): 「ログインして空のダッシュボードを開ける」
- M2(Phase 4-5完了): 「クリエイターが作品を公開し、ストアに出る」
- M3(Phase 6-7完了): 「購入してライブラリでDLできる」
- M4(Phase 8-9完了): 「adminが運用できる、READMEで再現可能」
