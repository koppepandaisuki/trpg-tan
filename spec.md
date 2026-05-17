# spec.md — TRPGプラットフォーム A版 MVP 仕様書

最終更新: 2026-05-18

---

## 1. プロダクト概要

TRPG(テーブルトークRPG)向けのWebプラットフォーム。
クリエイターがシナリオ・ルールブック・マップ・アート・BGMなどの作品をアップロードし、購入者がダウンロードして利用する「デジタル作品マーケット」。

A版MVPでは **「作る・売る・管理する」** の3点に集中する。

## 2. MVP対象範囲

以下の7機能を含む。

1. **認証** — Supabase Auth(メール+パスワード、メール確認あり)
2. **ストア一覧** — 公開作品の閲覧(カテゴリタブ、検索、ページネーション)
3. **作品詳細** — メタ情報・サンプル表示・購入導線
4. **クリエイター向けビルダー** — 作品作成・編集・下書き保存・公開
5. **ライブラリ** — 購入済み作品の一覧と署名URLでのダウンロード
6. **Stripe Checkout決済** — 1作品=1セッション、Webhookで購入確定
7. **admin最低限の管理画面** — ユーザー/作品/取引の閲覧、停止操作、クリエイター権限付与

## 3. 対象外(明示)

A版MVPでは作らない。混入しないよう注意する。

- 高機能VTT(マップ共有・ダイス・キャラクターシートの同期実行)
- リアルタイム同期プレイ、チャット、ボイス
- レビュー投稿/★評価/コメント
- お気に入り / ウィッシュリスト
- フォロー機能 / フォロワー管理
- クーポン管理
- カート(複数作品まとめ買い)
- ギフト購入
- 売上分析グラフ(累計値の表示のみ)
- 申請制クリエイター登録UI(MVPはadminが手動でフラグ付与)
- 多通貨対応(JPYのみ)
- クリエイターへの収益分配(Stripe Connect)
- 多言語対応(日本語のみ)
- モバイルアプリ
- メール配信(購入完了メールはStripe Receipt任せ)

## 4. 画面一覧

ルート設計案。Next.js App Router前提。

### 公開ルート

| パス | 画面 | レンダリング |
|---|---|---|
| `/` | トップ(ストア一覧へのリダイレクトまたはランディング) | SSG |
| `/store` | ストア一覧(タブ・検索・グリッド) | ISR or SSR |
| `/store/[workId]` | 作品詳細 | ISR or SSR |
| `/login` | ログイン | SSR |
| `/signup` | サインアップ | SSR |
| `/auth/callback` | Supabase OAuth/メール確認コールバック | SSR |

### 認証必須ルート

| パス | 画面 | 権限 |
|---|---|---|
| `/library` | 購入済み作品一覧 | user |
| `/library/[workId]` | ダウンロード画面(署名URL発行) | user(購入済み) |
| `/creator` | クリエイタートップ(累計売上/累計DL) | creator |
| `/creator/products` | 自分の作品管理(一覧) | creator |
| `/creator/products/new` | 新規作成ビルダー | creator |
| `/creator/products/[productId]/edit` | 編集ビルダー | creator(自作) |
| `/creator/sales` | 取引履歴 | creator |
| `/checkout/success` | 決済成功画面 | user |
| `/checkout/cancel` | 決済キャンセル画面 | user |

### admin

| パス | 画面 | 権限 |
|---|---|---|
| `/admin` | adminトップ(統計サマリ) | admin |
| `/admin/users` | ユーザー一覧・creatorフラグ付与/剥奪・停止 | admin |
| `/admin/works` | 全作品一覧・公開停止 | admin |
| `/admin/orders` | 全取引一覧・返金リンク | admin |

### APIルート(サーバー側)

| パス | 役割 |
|---|---|
| `POST /api/checkout` | Stripe Checkout セッション作成 |
| `POST /api/stripe/webhook` | Stripe Webhook(署名検証・購入確定) |
| `POST /api/library/[workId]/download` | 署名URL発行(購入確認後) |
| `POST /api/products/[productId]/cover-upload-url` | 表紙画像アップロード用署名URL |
| `POST /api/products/[productId]/file-upload-url` | 作品ファイルアップロード用署名URL |

## 5. 主要ユースケース

### 5.1 購入者(role=user)

1. サインアップ・メール確認 → ログイン
2. `/store` で作品を閲覧、カテゴリタブ・検索で絞り込む
3. `/store/[workId]` で詳細を確認、「今すぐ購入」を押下
4. Stripe Checkoutへリダイレクト → 決済完了 → `/checkout/success` へ戻る
5. `/library` に作品が反映される(Webhook完了後、通常数秒以内)
6. `/library/[workId]` でダウンロードボタン押下 → 短命の署名URLでファイル取得

### 5.2 クリエイター(role=user + creatorフラグ)

1. adminによりcreatorフラグを付与される(MVPでは手動)
2. `/creator/products/new` でビルダーを開く
3. 概要 → 基本情報 → 本文 → タグ → 価格 → 公開設定 → ファイル添付 の順に入力
4. 自動保存により下書き保存される
5. 表紙画像・作品ファイルをアップロード(Supabase Storage、署名URL経由)
6. 「公開設定」で公開日時を指定し「作品を作成」(=公開)
7. 公開後はストアに掲載され、購入が走るたび `/creator/sales` に記録

### 5.3 admin(role=admin)

1. `/admin/users` でユーザーを検索、`creator` フラグを付与
2. `/admin/works` で問題のある作品を停止(`status='suspended'`)
3. `/admin/orders` で取引を確認、Stripeダッシュボードへのリンクで返金対応

## 6. 非機能要件

### 6.1 性能
- ストア一覧の初回表示 < 2秒(Vercel JP リージョン)
- ISR(再検証60秒)でDB負荷を抑える
- 画像はSupabase Storage + Next.js Image最適化

### 6.2 セキュリティ
- **Supabase RLS は全テーブルで有効化**。デフォルト deny、必要なポリシーだけ追加
- `service_role` キーはサーバー側(Route Handler / Server Action)のみ。クライアントへは絶対に渡さない
- Stripe Webhook は **必ず署名検証**(`stripe.webhooks.constructEvent`)
- ファイルダウンロードは **短命(5分以内)の署名URL**、購入確認後のみ発行
- 入力は zod でサーバー/クライアント両方で検証
- `next-safe-action` の採用は検討段階。最低限 Server Action 内で zod 検証
- パスワード再設定UIはMVP内に含める(Supabase Auth標準フロー使用)

### 6.3 国際化
- 日本語のみ(`lang="ja"`)。i18nライブラリは導入しない
- 価格はJPY整数のみ。`Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' })` で表示

### 6.4 可観測性(最小)
- Vercel Analytics(無料枠)
- Stripe Webhook失敗はSlack通知不要、Stripeダッシュボードで確認

## 7. UI方針(画像から確定)

### トーン
- 中立的・無機質・整理されたSaaS UI
- 白背景 / 薄いグレー枠線 / ダークネイビーCTA / 青みグレーアクセント
- ファンタジー装飾なし、Notion・Linear寄りの静的な整い

### レイアウト共通パターン(3カラム)
- 左サイドバー(固定 ~240px): ナビ + クイックアクション + 軽量ウィジェット
- 中央メイン(可変): タブ/グリッド/フォーム
- 右サイドバー(固定 ~320px): アクションパネル / ライブプレビュー / 状態表示

### カラーパレット(目安)
- 背景: `#FFFFFF` / セクション背景 `#F9FAFB`
- 枠線: `#E5E7EB`
- テキスト: `#111827`(主) / `#6B7280`(副)
- CTA(主): `#1F2937`〜`#111827`
- アクセント(リンク等): `#2563EB`(青)
- カテゴリバッジ: 各カテゴリで薄い背景色

### タイポグラフィ
- 日本語: Noto Sans JP(`font-sans` をTailwindで再定義)
- 行間ゆったり(`leading-relaxed`)、字間ややゆったり(`tracking-normal`)
- 見出しはウェイトで強調、サイズは控えめ

### コンポーネント方針
- shadcn/ui を採用(コピー&所有、過剰な抽象化を回避)
- アイコンは lucide-react
- 角丸は8-12px、影は最小限(`shadow-sm` 主体)

## 8. データ要件(概要)

詳細は Phase 2 でDBスキーマとして確定する。

- ユーザー(Supabase Auth `auth.users` に紐づく `public.profiles`)
- 作品(`works`): タイトル / 説明 / カテゴリ / タグ / 価格 / 状態(draft/published/suspended) / 商用利用可否 / 二次配布可否 / 対応システム / プレイ人数 / プレイ時間 / 表紙画像パス / ファイルパス / ファイル形式 / クリエイターID
- 注文(`orders`): ユーザーID / 作品ID / Stripe checkout session ID / 状態(pending/paid/refunded) / 金額 / 通貨 / 購入日時
- ライブラリ(`orders` テーブルの `status='paid'` を JOIN で表現、別テーブルにしない)
- admin監査ログ(`admin_audit_logs`): いつ誰が何をしたか

詳細は spec.md ではなく **Phase 2 のDB設計タスク** で確定する。
