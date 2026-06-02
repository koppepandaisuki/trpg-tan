# TRPG プラットフォーム (MVP)

TRPG向けデジタル作品マーケットの A版 MVP。
クリエイターがシナリオ・ルールブック・マップ・アート・BGM を販売し、購入者がライブラリからダウンロードする。

> **α版を動作確認する人へ**: [ACCEPTANCE.md](ACCEPTANCE.md) の A〜G を上から順に実行してください。
> **次フェーズに進む人へ**: [decisions.md §7 P2 Backlog](decisions.md) で優先度を確認してください。

---

## 1. 機能範囲(MVP)

| カテゴリ | 含む | 含まない |
|---|---|---|
| 認証 | Email + パスワード、メール確認 | OAuth、MFA、パスワードリセット UI |
| ストア | 公開作品の一覧 / カテゴリタブ / 詳細 | レビュー、フォロー、お気に入り |
| ビルダー | テキスト中心の作品作成・編集、下書き / 公開、タグ | 表紙・本体ファイルのアップロード、自動保存、プレビュー |
| ライブラリ | 購入済み一覧、署名URL でのダウンロード | DL履歴、複数ファイル、プレビュー再生 |
| 決済 | Stripe Checkout(JPY)、webhook で paid 反映 | 無料作品の入手、返金実行 UI、収益分配、クーポン、税率 |
| admin | creator 権限の付与/剥奪、作品の停止/復帰、取引一覧、Stripe Dashboard 導線 | 返金の自前実行、CSV export、bulk、analytics、impersonation |
| 監査 | admin 操作はすべて `admin_audit_logs` にアトミック記録 | 監査ログの閲覧 UI(Phase 9 以降) |

すべての画面・実装は日本語の単一ロケール前提です。

---

## 2. 技術スタック

- **Next.js 14+ (App Router) / TypeScript / React 18**
- **Tailwind CSS** + 手書きの最小 UI プリミティブ(`components/ui/*`)
- **Supabase**: Auth / Postgres / Storage / RLS / RPC
- **Stripe Checkout (Hosted)** + Webhook、API バージョン `2024-06-20` 固定
- **react-hook-form + zod**: 認証フォーム、ビルダー
- **Vitest**: 純関数ユニットテスト
- **pnpm 9+ / Node 20+**

---

## 3. 必要な前提環境

| 項目 | バージョン |
|---|---|
| Node.js | 20 以上 |
| pnpm | 9 以上(`corepack enable` で有効化) |
| Supabase プロジェクト | 1つ(無料枠で動作)|
| Stripe アカウント | テストモードで OK |
| Stripe CLI | webhook をローカルへ転送するのに使用 |

---

## 4. クイックスタート

```bash
# 1. 依存関係をインストール
pnpm install

# 2. 環境変数の雛形をコピーして実値を入れる
cp .env.example .env.local
# 必須キーは下の「環境変数」セクション参照

# 3. Supabase に migration を適用(SQL Editor で 0001 → 0002 → 0003 を順に実行)
# 4. Stripe webhook を localhost に転送
stripe listen --forward-to localhost:3000/api/stripe/webhook
# 出力された whsec_... を .env.local の STRIPE_WEBHOOK_SECRET に入れる

# 5. 開発サーバー起動
pnpm dev
```

`http://localhost:3000/` を開くとトップページが表示されます。

---

## 5. 環境変数

`.env.local` に設定するキー。`.env.example` をコピーして編集してください。

| キー | 用途 | 公開可? |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | サイト URL(`http://localhost:3000` 等) | ✓ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | ✓ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role(**サーバー専用**)| ✗ |
| `STRIPE_SECRET_KEY` | Stripe Secret Key(**サーバー専用**) | ✗ |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook の署名検証用(**サーバー専用**)| ✗ |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 将来用、現状未使用でも可 | ✓ |

> **重要**: `*_SECRET_*` / `SERVICE_ROLE_*` は絶対に `NEXT_PUBLIC_` プレフィックスを付けないでください。また、Client Component から server-only モジュールを import するとビルド成果物に混入する経路ができてしまいます。詳細は §12 セキュリティを参照。

---

## 6. Supabase 準備

### 6.1 プロジェクト作成 + API キー

1. [Supabase](https://supabase.com) でプロジェクトを作成
2. Project Settings > API から URL / anon key / service_role key を取得し `.env.local` に転記

### 6.2 マイグレーション適用

`supabase/migrations/` のファイルを **番号順** に SQL Editor で実行:

| 番号 | ファイル | 内容 |
|---|---|---|
| 0001 | `0001_initial_schema.sql` | 拡張・ヘルパ関数・6テーブル・トリガー・`public_profiles` ビュー |
| 0002 | `0002_rls_policies.sql` | 全テーブルで RLS 有効化 + ポリシー |
| 0003 | `0003_admin_rpc.sql` | admin 操作のアトミック RPC(3関数) |
| 0004 | `0004_grant_profiles.sql` | `public.profiles` の SELECT を `authenticated` に付与(table GRANT 漏れの hotfix) |
| 0005 | `0005_grant_products.sql` | `public.products` の SELECT を `authenticated` に付与(同上) |
| 0006 | `0006_grant_purchases_tags.sql` | `public.purchases` / `public.product_tags` の SELECT を `authenticated` に付与(同上) |
| 0007 | `0007_storage_rls.sql` | `storage.objects` の `covers` / `product-files` バケットに INSERT/UPDATE/DELETE ポリシーを追加(path 第 1 セグメントが `auth.uid()` 一致を要求) |

`supabase` CLI を使う場合は `supabase db push` でまとめて適用できます。

### 6.3 Storage バケット

Storage > Buckets で以下を作成し、**各バケットに MIME 許可リストと サイズ上限を必ず設定** してください。バケット設定は migration では再現できない Supabase Studio 上の手動操作です。

| バケット | 公開設定 | `Allowed MIME types` | `Max file size` | 用途 |
|---|---|---|---|---|
| `covers` | **public** read | `image/png`, `image/jpeg`, `image/webp` | **10 MB**(`10485760` バイト) | 作品の表紙画像 |
| `avatars` | **public** read | `image/png`, `image/jpeg`, `image/webp` | **2 MB**(`2097152` バイト) | プロフィール画像(MVPでは未使用) |
| `product-files` | **private**(read ポリシー無し) | `application/pdf`, `application/zip`, `audio/mpeg`, `audio/wav` | **暫定 50 MB**(`52428800` バイト)※ | 作品本体ファイル。署名URLでのみ取得 |

> **絶対に守るべき設定**:
> - `product-files` に **public read ポリシーを付けない**。MVP の DRM 前提(購入確認後の signed URL のみで配布)が崩れます
> - 各バケットの `Max file size` は **必ず設定** する。0007 の Storage RLS は path prefix を守るだけで、巨大ファイル送信の防御はバケット設定でのみ可能
>
> ※ **`product-files` の 50 MB は暫定値**。Supabase Free プランの制約に合わせています。本番(Pro プラン)移行時は 200 MB に引き上げる手順を [decisions.md H-005](decisions.md) に明記しています。引き上げ時は以下を同時に更新してください:
>   1. Supabase Studio で `product-files` バケットの `Max file size` を `209715200` に
>   2. `lib/format/upload.ts` の `PRODUCT_FILE_MAX_BYTES` を `200 * 1024 * 1024` に
>   3. 本 README §6.3 の該当行を 200 MB に
>   4. `tests/format/upload.test.ts` の期待値を 200 MB に

**Storage RLS(`storage.objects` テーブル)** は migration 0007 で自動設定されます:
- `covers` / `product-files` 共通で、INSERT/UPDATE/DELETE は `path の第 1 セグメント == auth.uid()` を要求
- これにより、たとえ anon key + JWT を持つ別 creator が直接 `supabase.storage.from(...).upload(...)` を叩いても、他人の prefix 配下に書き込めない
- read はポリシーを作っていないため `product-files` は完全に拒否される(signed URL 経由のみアクセス可)
- 通常運用は Route Handler 経由の **signed upload URL**(Phase α 以降で実装予定)で、その経路では Supabase が事前承認するため RLS をバイパス。Storage RLS は直接アップロード攻撃に対する **二重防御** として機能

### 6.4 Auth 設定

Authentication > URL Configuration:
- **Site URL**: `http://localhost:3000`(**本番デプロイ後は本番ドメインに必ず書き換え** — §16 参照)
- **Redirect URLs** に `http://localhost:3000/auth/callback` を追加(本番ドメインも §16 で追加)

Email Provider を有効化(デフォルト ON)。メール確認は有効のまま。

> 💡 Site URL が確認メール / パスワードリセットメール内リンクのベース URL になります。
> 本番デプロイ時に更新を忘れると、サインアップしたユーザーのリンクが localhost を
> 指して詰まる事故になります(§16 step 6 の注記を参照)。

---

## 7. Stripe 準備

### 7.1 API キー

1. [Stripe Dashboard](https://dashboard.stripe.com) でアカウント作成(テストモード)
2. Developers > API keys から **Secret key** を取得 → `.env.local` の `STRIPE_SECRET_KEY`
3. Dashboard 側の API version を `2024-06-20` に合わせる(コード側で固定済み)

### 7.2 Webhook

ローカル開発:
```bash
# 別ターミナルで起動しておく
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

起動時に表示される `whsec_...` を `.env.local` の `STRIPE_WEBHOOK_SECRET` に設定します。

本番:
- Dashboard > Developers > Webhooks > Add endpoint
- URL: `https://<your-domain>/api/stripe/webhook`
- 購読イベント: `checkout.session.completed`, `checkout.session.async_payment_succeeded`
- 生成された `whsec_...` を本番環境の env に設定

### 7.3 テストカード

| 番号 | 用途 |
|---|---|
| `4242 4242 4242 4242` | 通常成功 |
| `4000 0000 0000 9995` | 残高不足エラー |
| `4000 0027 6000 3184` | 3D Secure |

有効期限・CVC は任意の未来日 / 任意の数字で OK。

---

## 8. 開発手順

### 8.1 起動

```bash
pnpm dev      # 開発サーバー(http://localhost:3000)
```

### 8.2 スクリプト一覧

| コマンド | 内容 |
|---|---|
| `pnpm dev` | 開発サーバー |
| `pnpm build` | 本番ビルド(prebuild で server-only 静的チェックが走る) |
| `pnpm start` | 本番モード起動 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm format` | Prettier 整形 |
| `pnpm test` | Vitest(watch モード) |
| `pnpm test:run` | Vitest(1 回実行) |
| `pnpm check:server-only` | server-only モジュールの静的チェック(`prebuild` でも走る) |
| `pnpm check:secrets` | `pnpm build` 後の client bundle に secret 名が混入していないか確認 |

### 8.3 開発用 seed

[supabase/seed.sql](supabase/seed.sql) を **手動で開いて**、Auth で作ったユーザーの UUID を変数に差し替えてから実行します。

```sql
-- supabase/seed.sql の冒頭(抜粋)
do $$
declare
  alice uuid := '<実際のUUID>'::uuid;  -- creator 用
  bob   uuid := '<実際のUUID>'::uuid;  -- creator 用
  carol uuid := '<実際のUUID>'::uuid;  -- admin 用
...
```

事前に Authentication で 3 ユーザーを作成し、UUID を控えてから実行してください。

### 8.4 admin の付与

`/admin` UI からは `is_admin` を付与できません(安全のため)。SQL Editor で直接実行:

```sql
update public.profiles set is_admin = true where id = '<対象ユーザー UUID>';
```

---

## 9. テスト

純関数のユニットテストのみ Vitest で実装しています(`tests/`)。

```bash
pnpm test:run       # 1回実行(CI 想定)
pnpm test           # watch モード
```

カバー範囲:
- フォーマッタ(price / category / status / stripe / slug)
- zod スキーマ(auth / product)
- redirect / sanitize / Origin 検証
- admin RPC エラー分類
- Stripe webhook の決定ロジック(`decideCheckoutOutcome`)

カバーしていない範囲:
- Supabase 実通信 / Stripe 実通信
- React コンポーネントレンダリング
- E2E

これらは手動確認で代替します。手動確認の一括チェックリストは [ACCEPTANCE.md](ACCEPTANCE.md) を参照してください。

---

## 10. ロール別の動作確認

α版受け入れの**完全な手順**は [ACCEPTANCE.md](ACCEPTANCE.md) に集約しています。各ロールのフロー要約のみ以下に残します。

| ロール | 主要フロー | ACCEPTANCE 該当 |
|---|---|---|
| 一般ユーザー(購入者) | サインアップ → 閲覧 → 購入(Stripe Checkout) → ライブラリで DL | D, F |
| クリエイター(creator、admin が付与) | 作品作成 → 下書き → 公開 → ストア掲載 | F-1〜F-3 |
| admin | creator 付与/剥奪、作品停止/復帰、取引確認、audit log 確認 | E |

---

## 11. 決済 / 返金の運用メモ

### 購入フロー
```
/store/[slug] → BuyButton → POST /api/checkout → Stripe Hosted Page
   完了 → success_url + 並行で Webhook が purchases に paid を書き込む
   キャンセル → cancel_url
```

webhook が **真実の源**。`/checkout/success` ページは webhook 遅延を前提にした文言で、`/library` で反映を確認します。

### 返金(Phase 8 時点)

返金は **Stripe Dashboard で実行** します。アプリ側に自前の Refund UI はありません。

```
1. /admin/orders で対象を確認
2. 「Stripe で開く」リンクから Stripe Dashboard を開く
3. Stripe Dashboard 内で Refund を実行
4. アプリ側の purchases.status は自動更新されない(paid のまま)
5. 配布を止めたい場合は /admin/products で当該作品を「停止」にする
6. 完全な自動化(`charge.refunded` webhook 反映)は P2 Backlog の B-1
```

詳細: [decisions.md](decisions.md) の D-016 / D-017。P2 着手計画は [decisions.md §7 P2 Backlog](decisions.md) の B-1 を参照。

---

## 12. セキュリティ上の注意点

| # | 注意 | 対応 |
|---|---|---|
| S-1 | `service_role` を Client Component から import しない | `lib/supabase/admin.ts` は `import "server-only"`。`pnpm check:server-only` で静的検査、`pnpm check:secrets` でビルド成果物検査 |
| S-2 | `product-files` バケットを public にしない | Storage RLS で read ポリシーを作らない。署名 URL は `lib/storage/signed-url.ts` 経由のみ |
| S-3 | Stripe webhook の署名検証 | `stripe.webhooks.constructEvent` を必ず通す。`STRIPE_WEBHOOK_SECRET` 未設定で 500 |
| S-4 | RLS 二重防御 | アプリ層(`canPurchase` / `canDownload`)で先に弾き、RLS でも最終防御 |
| S-5 | admin 操作のアトミック性 | `0003_admin_rpc.sql` の RPC が状態変更 + 監査ログを同一トランザクション |
| S-6 | API レスポンスは JSON で統一 | middleware は `/api/*` をリダイレクトせず、route handler が独自に 401 JSON を返す |
| S-7 | open redirect 防御 | `lib/api/redirect.ts` で `safeNext` / `sanitizeSlug` を集約 |
| S-8 | CSRF ベースライン | route handler 冒頭で `isSameOriginRequest`(`lib/api/origin.ts`)。本格的な CSRF トークンは将来検討 |
| S-9 | エラー応答での情報漏洩抑制 | 「未購入 / 停止中 / 存在しない」を **すべて同じ 403 JSON** にまとめる(理由は内部 log のみ) |
| S-10 | metadata に PII を入れない | Stripe metadata は productId / userId / slug / priceJpy / productType のみ |

### Client Component が secret に触れない仕組み
1. **`import "server-only"`** を必要なファイルの冒頭に置く(Next.js が client bundle に紛れたらビルド時に throw)
2. **`pnpm check:server-only`**(prebuild で自動実行)が静的に確認
3. **`pnpm check:secrets`** が `pnpm build` 後の `.next/static/` を grep して最終確認

---

## 13. 既知の制約 / MVP 対象外

| 項目 | 状態 |
|---|---|
| 無料作品の入手機能 | 詳細ページに「無料で入手(準備中)」表示のみ |
| 返金の自前実行 | Stripe Dashboard で手動。`charge.refunded` webhook は ack のみ |
| `purchases.status='refunded'` 自動反映 | しない(返金時は別途 admin が作品を suspended で対応) |
| 監査ログ閲覧 UI | 無し。Supabase Studio で参照 |
| 表紙・本体ファイルのアップロード UI | 無し。Storage Studio で手動投入 |
| 自動保存(ビルダー) | 手動保存のみ |
| 同一ユーザー × 同一作品の二重 paid | レース条件で発生しうる(購入1件として機能はする、累計集計が二重になる) |
| 検索 | `ilike` の部分一致のみ。本文検索なし |
| ページネーション | offset 方式、cursor 化未対応 |
| 多通貨 / 税率 / クーポン | JPY 固定、税込み表示、割引なし |
| OAuth / MFA / パスワードリセット UI | 未実装 |
| メール通知 | Supabase / Stripe 標準のみ |
| i18n | 日本語のみ |
| モバイルアプリ | なし |
| Stripe Connect / 収益分配 | なし(プラットフォーム取り) |

---

## 14. 今後の保留項目

P2 以降の作業候補は [decisions.md §7 P2 Backlog](decisions.md) に **Now / Next / Later** で整理しています。
α版運用開始前に着手する項目はありません。

要約:
- **Now**: `charge.refunded` webhook 本実装(B-1)
- **Next**: 監査ログ UI / アップロード UI / パスワードリセット / 自動保存
- **Later**: asset marketplace、AI 補助プレイのプリペイドポイント課金(いずれも構想段階)

詳細と着手ルールは [decisions.md §7](decisions.md) を参照。

---

## 15. ドキュメント

| ファイル | 役割 |
|---|---|
| [ACCEPTANCE.md](ACCEPTANCE.md) | **α版受け入れチェックリスト**(A〜G を上から順に実行) |
| [spec.md](spec.md) | MVP の対象範囲、画面一覧、主要ユースケース、非機能要件 |
| [plan.md](plan.md) | フェーズ分割、完了条件、依存関係 |
| [tasks.md](tasks.md) | フェーズごとの実装タスクチェックリスト(MVP は完了済み) |
| [decisions.md](decisions.md) | 技術判断 / 保留事項 / 前提 / 規約 / **§7 P2 Backlog** |

---

## 16. デプロイ(Vercel 概略)

1. Vercel プロジェクトを作成、リポジトリを接続
2. Build Command: `pnpm build`(prebuild の静的チェックが自動で走る)
3. Output: 標準
4. 環境変数を Vercel ダッシュボードに設定(§5 と同じキー)
5. デプロイ後、Stripe の本番 Webhook エンドポイントを `https://<your-domain>/api/stripe/webhook` に変更し、`STRIPE_WEBHOOK_SECRET` を本番値に更新
6. **Supabase Authentication > URL Configuration を本番値に必ず更新**:
   - **Site URL** を本番ドメインに**書き換える**(`http://localhost:3000` から変更)
     - ⚠️ これを忘れると **新規サインアップしたユーザーの確認メール内リンクが
       `http://localhost:3000/...` を指す**ため、テスターの手元で
       `ERR_CONNECTION_REFUSED` になり、誰もログインできない事故になります
   - **Redirect URLs(Additional Redirect URLs)** に
     `https://<your-domain>/**`(または最低限 `https://<your-domain>/auth/callback`)を追加
7. 6 の動作確認(予備メアドで実施):
   - 本番 URL からサインアップ → 届いた確認メール内のリンク URL が
     `https://<your-domain>/auth/callback?...` で始まっていること
   - リンクをクリック → アプリにログイン状態で着地すること

---

## 17. フェーズ完了状況

- [x] **Phase 1** プロジェクト土台
- [x] **Phase 2** DB設計 / RLS / Storage 設計
- [x] **Phase 3** 認証(Email + パスワード、保護ルート)
- [x] **Phase 4** ストア一覧 / 詳細
- [x] **Phase 5** クリエイター用ビルダー
- [x] **Phase 6** ライブラリ / 署名 URL(+ Phase 6.1: middleware の `/api/*` 切り分け)
- [x] **Phase 7** Stripe Checkout / Webhook
- [x] **Phase 8** admin 最低機能(RPC + audit log)
- [x] **Phase 9** テスト / セキュリティ / README 仕上げ
