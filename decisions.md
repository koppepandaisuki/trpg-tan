# decisions.md — 技術判断・保留事項・前提

最終更新: 2026-05-18

このファイルは「なぜそうしたか」を残すための記録。
判断が変わったら、古いエントリは消さず「(2026-XX-XX変更)」を追記する。

---

## 1. 技術判断(採用 + 却下)

### D-001 Next.js 14+ / App Router 採用
- **採用**: Next.js 14+ App Router、Server Actions
- **理由**: 依頼の指定。SSR + ISR でストア一覧の鮮度と速度を両立できる
- **却下**: Pages Router、Remix、Astro

### D-002 Supabase 採用
- **採用**: Supabase(Auth + Postgres + Storage + RLS)
- **理由**: 依頼の指定。認証・DB・ストレージを1ベンダで完結でき、MVPに過剰投資しない
- **却下**: Firebase(RLS的なものが弱い)、自前Postgres + NextAuth

### D-003 Stripe Checkout(Hosted) 採用
- **採用**: Stripe Checkout(Hosted Page、Embedded ではない)
- **理由**: 自前カード入力UIを持たないため PCI スコープが最小、Stripeで領収書も発行できる
- **却下**: Stripe Elements(自前UIが必要)、PayPal(国内TRPGコミュニティ的に優先度低)

### D-004 状態管理ライブラリは導入しない
- **採用**: Server Components + Server Actions + URL search params で十分
- **理由**: グローバル状態が必要な場面が見当たらない(認証セッションはSupabaseクライアントが持つ)
- **却下**: Zustand、Redux、Jotai

### D-005 フォーム: react-hook-form + zod
- **採用**: 依頼の指定。`@hookform/resolvers/zod` を使用
- **理由**: クライアント/サーバー両方で同じスキーマを使える

### D-006 UIライブラリ: shadcn/ui
- **採用**: shadcn/ui(コピー&所有)、アイコンは lucide-react
- **理由**: 依存パッケージを増やさず、必要な分だけ自分のコードベースに取り込める
- **却下**: MUI(重い、デザイン方針と合わない)、Mantine(同上)、Chakra(同上)

### D-007 i18nは入れない
- **採用**: 日本語ハードコード
- **理由**: 対象市場が日本のTRPGコミュニティ、MVPで多言語コストは過剰
- **再検討時期**: Phase 2(収益化ローンチ)以降

### D-008 検索は Postgres `ilike` から始める
- **採用**: Phase 4 では `ilike '%query%'` で済ます
- **理由**: 作品数が少ない初期は十分。`tsvector` は実データ量を見てから入れる
- **将来移行**: 1000件超 or 検索遅延が問題化したら `tsvector` + GIN index

### D-009 自動保存は debounce 2秒の Server Action
- **採用**: クライアント側 `useDebouncedCallback(2000)` で Server Action 呼び出し
- **理由**: WebSocket等の重い仕組みは不要、ネットワーク負荷も最小
- **却下**: 5秒間隔ポーリング、リアルタイム同期

### D-010 service_role アクセスはサーバー専用モジュールに隔離
- **採用**: `lib/supabase/admin.ts` の冒頭に `import 'server-only'`
- **理由**: ビルド時にクライアント側から間違って参照したらエラーになる
- **検証**: Phase 9 で `next build` 後の出力を grep

### D-011 Webhook ハンドリングは UNIQUE 制約で冪等化
- **採用**: `orders.stripe_session_id UNIQUE` + upsert
- **理由**: Stripe はリトライを送ってくる前提。アプリ側でフラグ管理しなくて済む
- **却下**: アプリ側で「処理済みID」テーブルを別途持つ(同等のことができるが冗長)

### D-012 ファイルダウンロードは Storage 署名URL(5分)
- **採用**: API ルートで購入確認 → `createSignedUrl(path, 300)`
- **理由**: クライアントに永続URLを渡すと購入後に共有される危険、5分なら現実的な配布リスクは低い
- **代替**: 自前プロキシ(オーバーキル)、CloudFront署名URL(Supabase外)

### D-013 admin判定は `profiles.is_admin` フラグ
- **採用**: DBカラム + RLS で判定、`requireAdmin()` ヘルパで保護
- **理由**: Supabase Auth にロールがない、JWT carry of custom claim も可能だが MVP では冗長
- **却下**: 環境変数で「adminメールリスト」(DBで管理した方が監査しやすい)

### D-014 メール送信はMVPでは Supabase 標準のみ
- **採用**: 認証関連(確認メール、パスワード再設定)は Supabase の標準テンプレ
- **理由**: 購入完了通知は Stripe Receipt で代替できる
- **却下**: Resend / SendGrid 導入は Phase 2 以降

### D-015 アクセス解析は Vercel Analytics のみ
- **採用**: Vercel Analytics(無料枠)、必要になったら追加
- **却下**: GA4、PostHog(MVP には不要)

---

## 2. UI / UX 判断

### D-101 デザイントークンはTailwind config に集約
- **採用**: `tailwind.config.ts` の `theme.extend.colors` でカラー、`fontFamily` でフォントを定義
- **理由**: コンポーネント側に色を直接書かない、後で変えられる

### D-102 「カートに追加」はMVPでは出さない
- **採用**: 詳細画面のCTAは「今すぐ購入」のみ
- **理由**: カート=複数決済のまとめ機能、MVPで実装する価値が低い
- **画像との差分**: 画像3 にある「カートに追加」ボタンは MVP では表示しない

### D-103 ★評価、お気に入り、フォロワー数はMVPで表示しない
- **採用**: 詳細画面・カードに表示せず、Phase 2 以降で実装
- **理由**: 投稿UI・集計を作ると Phase 5 が肥大
- **画像との差分**: 画像3 の数値はサンプル。MVPでは表示せず、レイアウト枠も持たない(後で挿入できるよう余白は確保)

### D-104 クリエイターダッシュボードのグラフは出さない
- **採用**: 累計売上 + 累計DL の2数値のみ
- **理由**: 月次集計やトレンドはBI領域、MVP対象外

---

## 3. 保留事項(未決定で後で決める)

### H-001 クリエイター登録フロー
- **現状**: MVPは admin が手動で `is_creator=true` を付与
- **未決**: 公開申請UIをいつ作るか
- **再検討**: Phase 2 開始時、もしくはユーザー数が増えて手動が破綻したとき

### H-002 収益分配(Stripe Connect)
- **現状**: MVPはプラットフォーム全取り(クリエイター分配なし)
- **未決**: 分配ロジック、KYC、税務処理
- **再検討**: Phase 2(収益化ローンチ)で必須化

### H-003 多通貨対応
- **現状**: JPYのみ
- **未決**: USD/EUR対応の必要性、税表示の仕様
- **再検討**: 海外ユーザーの問い合わせ実績が出てから

### H-004 販売停止された作品の購入済みユーザー扱い
- **現状(暫定)**: DL不可とする
- **未決**: 利用規約に基づく扱いを法務観点で確認
- **対応**: Phase 6 開始時にユーザーと最終確認

### H-005 ファイルサイズ上限
- **現状(暫定)**: 表紙画像 10MB、作品ファイル 200MB
- **未決**: 実際のクリエイターのユースケースから再調整
- **対応**: Phase 5 でクリエイター候補にヒアリング

### H-006 メール送信プロバイダ
- **現状**: Supabase 標準のみ
- **未決**: 購入完了メール、サポートからのお知らせ等を始めるタイミング
- **再検討**: Phase 9 以降、ユーザーフィードバックを見て

### H-007 ZIPファイル中身検証
- **現状**: 検証なし、サイズ上限のみ
- **未決**: マルウェアスキャン、悪意ある拡張子のブロック
- **再検討**: 一般公開前に必須化(現状はクローズドβ前提)

---

## 4. 前提条件(動かす上で必要なもの)

### A-001 Supabase プロジェクト
- 本人が事前に作成済みであること
- Auth の Email Provider 有効化、Site URL を本番ドメインに設定
- Storage バケット `covers`(public)、`works`(private)を作成
- マイグレーションは `supabase db push` で適用

### A-002 Stripe アカウント
- 本人が事前に作成済み、本番モード有効化済み
- Webhook エンドポイント登録(本番ドメイン)
- テスト環境では `stripe listen` で localhost に転送

### A-003 Vercel プロジェクト
- 本人が事前に作成済み
- 環境変数(`SUPABASE_*`, `STRIPE_*`, `NEXT_PUBLIC_*`)登録済み
- Build Command: `next build`、Output: 標準
- Node.js 20 LTS 推奨

### A-004 開発環境
- Node.js 20+
- pnpm(または npm/yarn、決定はPhase 1で)
- Stripe CLI(ローカル Webhook 疎通用)
- Supabase CLI

---

## 5. 規約

### N-001 ディレクトリ規約
```
app/                     # App Router ルート
  (public)/             # 非認証グループ(store)
  (app)/                # 認証必須グループ(library, creator, admin)
    creator/            # クリエイター(products 配下にビルダー等)
    admin/              # admin
    library/            # 購入済み
  api/                  # Route Handlers
components/             # 共有コンポーネント
  ui/                   # shadcn/ui 由来
  layout/               # レイアウト(header, sidebar, three-column 等)
  store/                # ストア特化(P4以降)
  builder/              # ビルダー特化(P5以降)
  admin/                # admin特化(P8以降)
lib/                    # ロジック
  supabase/             # client/server/admin
  stripe/               # client/webhook
  queries/              # データ取得関数
  validators/           # zod スキーマ
  auth.ts               # 認証ヘルパ
types/                  # 型定義(自動生成含む)
supabase/migrations/    # SQL マイグレーション
```

### N-002 命名規約
- ファイル: kebab-case(コンポーネントは PascalCase の `.tsx` のみ)
- React コンポーネント: PascalCase
- 関数・変数: camelCase
- 定数: SCREAMING_SNAKE_CASE
- DB テーブル/カラム: snake_case
- enum 値(`works.status` 等): `lowercase_snake`(`draft`, `published`, `suspended`)

### N-003 コミットメッセージ
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- 例: `feat(builder): add auto-save with 2s debounce`

### N-004 Server Action vs Route Handler
- **Server Action**: フォーム送信、ユーザーセッション前提の変更操作
- **Route Handler**: Stripe Webhook、署名URL発行(外部からのHTTP呼び出し、第三者からの呼び出し)

### N-005 zodバリデーションの場所
- スキーマは `lib/validators/` に集約
- Server Action 冒頭で必ず `parse()`、失敗時は `actionError` を return
- 同じスキーマを react-hook-form の `zodResolver` で再利用
