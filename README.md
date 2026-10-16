# Re-dice(リダイス)

卓を立てて、すぐ遊ぶ。ブラウザとデスクトップアプリで遊べる TRPG オンラインセッションツール。
参加者はログインもインストールも不要で、GM から届いたリンクを開くだけで遊べる。

- 公開サイト: https://re-dice.net
- 2026-09 にストア(作品の売買)を廃止し、「卓を立てて遊ぶ道具」に絞った(decisions.md)。
  この README のうち §6 以降の一部(Storage バケット・返金など)はストア時代の記述が残っている。

> **α版を動作確認する人へ**: [ACCEPTANCE.md](ACCEPTANCE.md) の A〜G を上から順に実行してください。
> **方針・優先度**: [docs/strategy.md](docs/strategy.md) と [decisions.md](decisions.md)。

---

## 1. 機能

| 機能 | 内容 |
|---|---|
| PLAY(Web / デスクトップ) | 盤面・駒・シーン・BGM・カットイン・テロップ・タイマー・ターン管理・カード(山札)・共有メモ・リプレイ。BCDice で 280 以上のシステムのダイス。シークレットダイスと秘密のチャットは本人宛てに暗号化。全メッセージに署名(なりすまし対策) |
| 通信 | GM を中心にした WebRTC 直結(P2P)+ Supabase Realtime の中継へ自動で切り替え。有料プランは Cloudflare TURN(設定時) |
| シナリオ工房の取り込み | 「TRPGシナリオ工房」のバックアップ zip から、シーン・読み上げ文・NPC・ハンドアウト入りの卓を作る |
| キャラシ | クトゥルフ神話TRPG(第7版・第6版)の専用エディタと、各システムのプリセット。ログインなしで作成、保存はクラウド(無料 10 体 / Pro 無制限) |
| ライブラリ | 自分の卓(自動保存)と素材(画像・音声。R2 または Supabase Storage) |
| 日程調整・フレンド | 候補日を並べて URL を配る日程調整(回答はログイン不要)、招待リンクでフレンド |
| デスクトップアプリ | Tauri 2(Windows)。PLAY・キャラクター・ビルダー(シナリオ / システム)・ルールブック Q&A(AI。ゴールド消費) |
| プラン | 基本(無料)/ プレイ / Pro を Stripe Subscription で。ゴールド(AI 用の前払い)とリデームコード |

すべての画面は日本語の単一ロケール前提。配色・ボタン・タブの規則は decisions.md の D-105。

---

## 2. 技術スタック

- **Next.js 14(App Router)/ TypeScript / React 18** — Web(`app/`, `components/`, `lib/`)
- **Tauri 2 + Vite + React** — デスクトップアプリ(`apps/desktop/`)。同じものを PWA として `/app` でも配信
- **pnpm workspace** — 共通の純粋 TS(`packages/trpg-core`: ダイス・卓の状態・同期・暗号)と共通 UI(`packages/trpg-ui`: キャラシ)
- **Tailwind CSS** + 最小の UI 部品(`components/ui/*`: Button / Tabs / Badge / Card / Input)
- **Supabase**: Auth / Postgres / Storage / RLS / RPC / Realtime(卓の中継・在席)
- **Stripe**: Checkout(Hosted)+ Customer Portal + Webhook(プランとゴールド)
- **任意**: Cloudflare R2(素材)、Cloudflare TURN(確実接続)、Google AdSense
- **Vitest**: 純関数ユニットテスト(Web と `packages/trpg-core`)

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

### 5.1 必須 / 恒久 env

| キー | 用途 | 公開可? |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | サイト URL(`http://localhost:3000` / 本番ドメイン) | ✓ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | ✓ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role(**サーバー専用**)| ✗ |
| `STRIPE_SECRET_KEY` | Stripe Secret Key(**サーバー専用**) | ✗ |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook の署名検証用 — platform endpoint(`checkout.session.completed` / `charge.refunded`)用(**サーバー専用**)| ✗ |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Stripe Webhook の署名検証用 — Connect endpoint(`account.updated`)用、D-020 PR2 以降(**サーバー専用**)| ✗ |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 将来用、現状未使用でも可 | ✓ |

> **重要**: `*_SECRET_*` / `SERVICE_ROLE_*` は絶対に `NEXT_PUBLIC_` プレフィックスを付けないでください。また、Client Component から server-only モジュールを import するとビルド成果物に混入する経路ができてしまいます。詳細は §12 セキュリティを参照。

### 5.2 α 期間限定 env(Phase 2 で全て撤去予定)

α 検証を円滑にするための暫定 env。**すべて未設定なら機能オフ**で、削除して Redeploy すれば自動的に無効化されます。Live 切替時には `ALPHA_*` を全削除(§18 ランブック参照)。

| キー | 用途 | 撤去予定 |
|---|---|---|
| `ALPHA_AUTO_CREATOR_EMAILS` | カンマ区切りメアド。該当ユーザーは初回ログイン時に自動で `is_creator = true` 付与(`decisions.md H-001` 代替) | creator 申請 UI 実装時(Phase 2) |
| `ALPHA_ALLOW_FREE_WITHOUT_CONNECT` | `"true"` のとき、Stripe Connect 未完了でも価格 ¥0 商品の公開可。本人確認で詰まったテスター救済 | Connect onboarding UX 改善時(Phase 2) |
| `DISCORD_FEEDBACK_WEBHOOK_URL` | アプリ内 💬 ボタン投稿の転送先(Discord webhook URL) | β 以降に分析ツール導入時 |

#### 5.2.1 設定方法(Vercel Production)

1. Vercel → Project → Settings → Environment Variables
2. **Production スコープのみ**にチェック(Preview / Development には入れない)
3. Sensitive チェックは任意(推奨)
4. Save → Deployments → 最新 Production → **Redeploy**(Use existing Build Cache 可)

#### 5.2.2 撤去手順

1. Vercel から env を削除 → Redeploy(機能オフ、コードは未設定で no-op)
2. Phase 2 で関連コード一式を撤去(該当 P2 Backlog 項目)

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

α版受け入れの手順は [ACCEPTANCE.md](ACCEPTANCE.md)。要約:

| ロール | 主要フロー |
|---|---|
| ゲスト(未ログイン) | 招待リンク / 参加コードで卓に入る → 発言・ダイス・自分の駒を動かす。キャラシの作成、日程調整の回答 |
| ユーザー | 卓を立てる(GM)→ 参加コードを共有 → 遊ぶ → ライブラリに自動保存。キャラシの保存、フレンド、プランの変更 |
| admin | ユーザー管理(プラン・ゴールドの付与)、MFA、異常検知 |

---

## 11. 決済の運用メモ

- プラン: `/pricing` → Stripe Checkout(サブスクリプション)。解約・支払い方法の変更は、利用中のプランの「契約を管理」から Customer Portal
- ゴールド(AI 用の前払い): デスクトップアプリから Checkout
- 反映の正は webhook(`/api/stripe/webhook`)。`/checkout/success` は遅延を前提にした文言
- 詳しい運用は [docs/stripe-operations.md](docs/stripe-operations.md)。Stripe の商品画像は `branding/stripe-plan-*.png`(作り直しは [scripts/brand/README.md](scripts/brand/README.md))

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

## 13. 既知の制約

| 項目 | 状態 |
|---|---|
| 事業者情報(特商法の表記) | env の `OPERATOR_*` が未設定なら「請求があれば遅滞なく開示」の表記(docs/legal) |
| 電気通信事業の届出 | 手続き中([docs/legal/README.md](docs/legal/README.md) §1) |
| モバイルアプリ | なし(スマホはブラウザで参加できる) |
| i18n | 日本語のみ |

---

## 14. 今後の保留項目

[docs/strategy.md](docs/strategy.md)(大手との比較と優先度)と [decisions.md §7 Backlog](decisions.md)。

---

## 15. ドキュメント

| ファイル | 役割 |
|---|---|
| [ACCEPTANCE.md](ACCEPTANCE.md) | **α版受け入れチェックリスト**(A〜G を上から順に実行) |
| [decisions.md](decisions.md) | 技術判断 / UI 判断(D-105 配色)/ 保留事項 / **§7 Backlog** |
| [docs/strategy.md](docs/strategy.md) | 大手(ココフォリア等)との比較と、改良の優先度 |
| [docs/legal/README.md](docs/legal/README.md) | 規約・届出・表記の整理 |
| [scripts/brand/README.md](scripts/brand/README.md) | OGP・Stripe・インストーラー画像の作り直し |
| [spec.md](spec.md) / [plan.md](plan.md) / [tasks.md](tasks.md) | ストア時代(MVP)の記録 |

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

---

## 18. Live mode 切替ランブック(本番運用開始時の手順)

α 検証が完了して **Live mode で実カード決済を受け付ける**段階に進むときのランブック。**順序が重要**なので上から順に実施すること。**順序を破ると購入が落ちる / creator に入金されない / Stripe アカウントがロックされる**等の事故が発生する。

### 18.1 事前条件チェック

- [ ] α 検証で `decisions.md` 設定の成功判定基準(a + c + d + f)を満たした
- [ ] `decisions.md §7.3 B-14`(Stripe v2 イベント対応)が実装済 — `account.updated` の v2 形式に対応していないと Connect の自動同期が落ちる
- [ ] α テスター全員に **Live 切替予定日**を Discord 等で事前通知済
- [ ] Test mode 期間中に作成した既存購入レコードの扱い方針が決定済(基本は履歴として残し、Live 入金は対象外)

### 18.2 Stripe 本番アカウント準備

#### 1. Stripe アカウント Activate
1. Stripe Dashboard 右上の **「Activate account」/「本番環境を有効化」** をクリック
2. プラットフォームの事業情報・代表者本人確認・銀行口座情報を入力
3. Stripe 審査(最大数日)を待つ

#### 2. Stripe Connect Live mode 設定
1. Dashboard 右上のトグルで **Live mode** に切替
2. Settings → Connect → プラットフォームプロフィールが Live mode でも完了していること確認
3. Settings → Connect → platform-profile に「**Responsibility for losses on connected accounts**」(D-020 PR2 でハマった項目)同意済確認

#### 3. Live mode webhook endpoint 2 つ登録
Test mode と同じ手順で **Live mode 側にも 2 つ**作る:

| endpoint | 種別 | URL | Events |
|---|---|---|---|
| Platform | "Events on your account" | `https://<your-domain>/api/stripe/webhook` | `checkout.session.completed` / `charge.refunded` |
| Connect | "Events on Connected accounts" | `https://<your-domain>/api/stripe/webhook`(同じ URL) | `account.updated`(v2 形式に注意、B-14 後) |

API version は Dashboard ドロップダウンの最新値を選択(2026 年時点では `2026-04-22.dahlia` 系)。**両 endpoint の signing secret(whsec_...)を別々に控える。**

### 18.3 Vercel env を Live 値に切替

#### 1. 既存 env を Live 値で上書き

Vercel → Settings → Environment Variables、各 env の Production 値を以下に更新:

| env | Test 値 → Live 値 |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` → `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Test platform `whsec_...` → **Live platform `whsec_...`** |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Test connect `whsec_...` → **Live connect `whsec_...`** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` → `pk_live_...` |

> 💡 1 つでも Test 値が残ると署名検証が落ちて webhook が 400、購入完了が DB に反映されない事故になります。**4 つ全部同時に更新する。**

#### 2. α 期間限定 env を**削除**

| env | アクション |
|---|---|
| `ALPHA_ALLOW_FREE_WITHOUT_CONNECT` | **削除**(Live mode では Connect 必須に戻す。残すと creator が無料商品を Connect なしで公開できる状態が継続) |
| `ALPHA_AUTO_CREATOR_EMAILS` | **削除**(creator は admin 手動付与に戻す。Phase 2 で申請 UI 実装するまでの暫定) |
| `DISCORD_FEEDBACK_WEBHOOK_URL` | β に持ち越し可(残すとβ ユーザーからもフィードバックが流れ続ける、運用判断) |

#### 3. Vercel Redeploy(必須)

Deployments → 最新 Production → **Redeploy**(Use existing Build Cache 可)。env 変更は次デプロイから有効になるため必須。

### 18.4 Supabase 確認(基本的に変更なし)

- Authentication → URL Configuration が `https://<your-domain>` であること再確認(α 中に既に修正済のはず)
- `supabase_migrations.schema_migrations` テーブルで 0001 〜 最新まで apply 済確認

### 18.5 Live mode 本番疎通テスト

#### 1. Webhook test
- Stripe Dashboard → 各 endpoint → **「Send test webhook」**
- Platform endpoint: `checkout.session.completed` → HTTP **200**
- Connect endpoint: `account.updated`(v2)→ HTTP **200**(B-14 後)

両方 200 なら、Vercel env と Stripe Dashboard endpoint の対応が正しい。

#### 2. 実 Connect onboarding 1 件完走
- 自分自身の creator アカウントで `/creator/onboarding` から Live mode の Connect onboarding を完走
- **本物の身分証 + 本物の銀行口座**情報を入力
- `profiles.stripe_charges_enabled = true` 確認

#### 3. 実カード少額決済 1 件
- 別アカウントから ¥100 程度の商品を**実カード**で購入
- Stripe Dashboard → Payments → 該当決済:
  - `application_fee_amount` = 30 円(=価格の 30%)
  - `transfer` = 70 円(= creator account 宛)
- Supabase で `purchases` 行が `status='paid'` で書かれている
- 購入者の `/library` で表示・DL 動作
- 数営業日後、creator の銀行口座に入金されること確認

### 18.6 ローンチ判定

上記すべて達成 = ローンチ可能状態。

### 18.7 α テスター移行通知

α テスターに以下を Discord で通知:
- Live mode に切替完了
- α 中に Test mode で作った購入履歴は表示として残るが、実金銭は移動していない旨
- 新規 / 既存テスター ともにフィードバック収集は継続
- creator は再度 Live mode で Connect onboarding を完走する必要がある(Test mode の Connect account は流用不可)

### 18.8 ロールバック手順(緊急時)

Live 切替後 24 時間以内に致命的問題発覚した場合の戻し方:

1. Vercel env の `STRIPE_*` を全部 Test 値に戻す
2. `ALPHA_*` を再度設定
3. Vercel Redeploy
4. Discord で α テスターに「一時的に Test mode に戻した」旨通知
5. 原因調査 → 修正 PR → 再度 Live 切替

Live で動いた実カード決済はそのまま残るので、Stripe Dashboard で必要に応じて手動 refund。
