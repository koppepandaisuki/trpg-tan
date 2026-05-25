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
- **採用**: `purchases.stripe_session_id UNIQUE` + INSERT → on duplicate-key no-op
- **理由**: Stripe はリトライを送ってくる前提。アプリ側でフラグ管理しなくて済む
- **却下**: アプリ側で「処理済みID」テーブルを別途持つ(同等のことができるが冗長)
- **Phase 7 補足**: 「同一 user × 同一 product を別 session で二重 paid」は理論上ありうるが、`canPurchase()` の既購入チェックで一次防御。極端な同時送信での重複は許容(運用上、購入は1件 / DL は1件として機能、累計集計のみ二重カウント)

### D-017 admin 操作は SECURITY DEFINER 関数(RPC)でアトミック化
- **採用**: `supabase/migrations/0003_admin_rpc.sql` で `admin_grant_creator` / `admin_revoke_creator` / `admin_set_product_status` を定義
- **理由**:
  - mutation と `admin_audit_logs` INSERT を同一トランザクションに収め、「片方だけ成功する事故」を防ぐ
  - SECURITY DEFINER + `auth.uid()` での admin 判定で `service_role` を使わずに済む
  - 監査ログが書けなければ本体変更も巻き戻る(ユーザー指示の厳格要件)
- **EXECUTE 権限**: `authenticated` のみに付与、`public` は revoke
- **`is_admin` の付与/剥奪 RPC は意図的に作らない**(DB 直接運用)
- **search_path 固定**: `public, pg_catalog` でハイジャック対策

### D-018 admin による draft 作品操作は Phase 8 では対象外
- **採用**: admin の操作ボタンは `published`/`draft` → 停止、`suspended` → 公開復帰/下書きへ、の3ケースのみ
- **対象外**: draft 作品を直接 admin が触る(規約違反 draft の停止など)
- **理由**: MVP 運用上、creator 自身に任せて問題ない範囲。スパム駆除は将来 admin 削除を別途検討
- **保留**: draft 作品への admin 直接操作の必要性を Phase 9 で再評価

### D-016 返金フローは Phase 7 では設計のみ、実装は Phase 9 で完了

- **採用方針**:
  - Phase 7 の webhook は `charge.refunded` / `refund.created` / `refund.updated` を
    **受信して 200 OK で ack**（再送防止）する。`purchases` の更新は行わない
  - 返金時の `purchases.status='refunded'` 遷移は **Phase 8 で admin Server Action**
    （service_role）から行う想定だったが、**Phase 9 で webhook 自動更新として前倒し実装**
  - **`purchases.status='paid'` のレコードのみが library に表示・DL可能**
    （Phase 6 で確立）。返金時はこの不変条件で自然にアクセスが止まる

- **理由**:
  - partial refund / 多段 refund / 自動 vs 手動の判定など、refund フローは
    Phase 7 のスコープを越えるため段階的に実装
  - 「webhook が自動で status を変える」設計は当初、Stripe Dashboard 側の手動操作と
    Phase 8 の admin 操作が混ざると競合する懸念があった
  - 結果として webhook の冪等パス（stripe_session_id から purchases を引いて upsert）
    により競合なく実装できることが確認できたため前倒し実装を採用

- **✅ 実装済（2026-05-22）**:
  - `lib/stripe/webhook.ts` に以下を追加
    - `RefundOutcome` 型
    - `decideRefundOutcome`（純関数）
    - `handleChargeRefunded`（impure ハンドラ）
  - `lib/mutations/purchases.ts` に `markPurchaseRefunded` を追加
  - `app/api/stripe/webhook/route.ts` はインライン実装を削除し
    `handleChargeRefunded` を import する薄いディスパッチャに整理
  - `tests/stripe/refund-outcome.test.ts` の import パスを
    `@/lib/stripe/webhook` に修正

- **実装の保証**:

  | 項目 | 内容 |
  |---|---|
  | 部分返金は skip | `decideRefundOutcome` 内で判定 |
  | 冪等性 | `.eq("status", "paid")` の二重フィルタで重複更新なし |
  | session 未発見 | warn ログ + 200 OK（Stripe リトライ不要） |
  | Stripe API session ルックアップ | `getStripe()` 経由で取得 |
  | DB エラー時 | `markPurchaseRefunded` で throw → 500 → Stripe リトライ |
  | pnpm typecheck | exit 0 |
  | pnpm test:run | 13 files / 118 tests pass |
  | check-server-only.mjs | passed |

- **現在の運用フロー**:
  1. admin が `/admin/orders` で対象購入を確認
  2. 「Stripe で開く」リンクから Stripe Dashboard を新規タブで開く
  3. Stripe Dashboard の Payment 詳細画面で Refund を実行
  4. `charge.refunded` webhook が発火し、自動で `purchases.status='refunded'` に更新
  5. ライブラリから即時アクセス不可・DL不可になる

- **DB の担保**:
  - `purchases.status` の CHECK が `paid | refunded | pending` を許容
  - `refunded_at` が `status='refunded'` で必須（Phase 2 で実装済み）
  - `stripe_session_id` UNIQUE 制約により冪等 upsert が安全に動作

- **対称アーキテクチャ**（checkout と refund で統一）:

  | 経路 | 純関数 | impure ハンドラ | DB 層 |
  |---|---|---|---|
  | checkout.session.completed | `decideCheckoutOutcome` | `handleCheckoutCompleted` | `upsertPurchaseFromSession` |
  | charge.refunded | `decideRefundOutcome` | `handleChargeRefunded` | `markPurchaseRefunded` |

  `route.ts` は薄いディスパッチャのみ。Stripe API / Supabase Admin Client に直接触らない。

### D-012 ファイルダウンロードは Storage 署名URL(5分)
- **採用**: API ルートで購入確認 → `createSignedUrl(path, 300)`
- **理由**: クライアントに永続URLを渡すと購入後に共有される危険、5分なら現実的な配布リスクは低い
- **代替**: 自前プロキシ(オーバーキル)、CloudFront署名URL(Supabase外)
- **重要(Phase 2 で再確認)**: `product-files` バケットは **クライアント直接 read 不可**。
  「購入済みユーザーが直接 read できる」形にもしない。
  購入確認は Phase 6 の API ルート内で行い、`service_role` クライアント経由でのみ
  署名URLを発行する。バケットの Storage RLS で read ポリシーを作らないことで
  この前提を担保する。

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

### D-019 ファイルアップロード設計(Q1〜Q10 確定事項)
`/grill-me` セッションで Q1〜Q10 を順に詰めて確定した設計の集約。Phase α〜ε で実装。
個別の関連 entry(H-005 / D-006 / D-012 / D-013 / N-004 など)はそのまま、本 entry が「上位の設計図」として参照される位置づけ。

- **Q1 / A — スコープ**: creator がファイルをアップロードする UI の正規化(B-3 系)。既存の Phase 6 DL、Phase 7 checkout、admin 操作はすべて据え置き、書き込み側だけ整備
- **Q2 / B-3c — 対象**: `products.cover_path`(表紙)と `products.file_path`(本体)の **両方** を同一フェーズシリーズで実装。ACCEPTANCE F-2 / F-7 / F-10 のクリティカルパスを一発で閉じる
- **Q3 / C-2 — アップロード経路**: Server が `createSignedUploadUrl` を発行 → Browser が直接 PUT。Vercel 関数 body 制限を回避し、大きなファイルも扱える。proxy 経由(C-3)は明示却下
- **Q4 / D-1 — HTTP 経路**: Route Handler(`POST /api/products/[productId]/cover-upload-url` / `file-upload-url`)。Phase 6 DL / Phase 7 checkout と同じ "imperative API 経路は Route Handler" パターン(N-004 と整合)
- **Q5 / E-1 — Storage パス命名**:
  - `covers/{creator_id}/{product_id}.{ext}` / `product-files/{creator_id}/{product_id}.{ext}`
  - `upsert: true` で再アップロードは同 path 上書き
  - 拡張子変更時の旧 path は孤立(H-005 に既知の保留事項として記録)
  - 拡張子は MIME 許可リスト経由で確定(cover: png/jpg/webp、PDF: pdf、image_zip: zip、audio: mp3/wav)
- **Q6 / G-2 — Storage RLS**: migration 0007 で最低限の path prefix 防御。
  - `(storage.foldername(name))[1] = auth.uid()::text` を INSERT/UPDATE/DELETE policy に
  - 通常運用(signed upload URL 経由)は RLS をバイパスするため、これは URL 漏洩 + anon 直接 upload 攻撃への二重防御
  - read policy は意図的に作らない(covers はバケット設定で公開、product-files は signed URL only)
- **Q7 / F-1 — DB 書き込みタイミング**: URL 発行 = `cover_path` / `file_path` を DB に即時 UPDATE(単段)。
  - Route Handler 内で `canUpload...` → `updateProduct...Path` → `createSignedUploadUrl` の順
  - PUT 失敗 = DB に path、Storage に物体なし の一時的不整合は許容、再 UL で自己修復
  - Confirm エンドポイントを置く F-2 案は MVP には過剰(API 倍増、UX 利得小)
- **Q8 / H-4 — MIME / サイズ検証 多層**:
  - クライアント: `<input accept>` + JS size early reject(UX)
  - サーバー: MIME 許可リスト + `products.file_format` 整合性チェック(認可と path 確定のため必須)
  - Supabase Storage バケット設定: `allowed_mime_types` + `file_size_limit`(究極防御)
  - 単独層では不十分、3 層揃って初めて安全
- **Q9 / I-3 — UI トリガー方式**: ハイブリッド。ファイル選択 → 即アップロード(独立)、フォーム保存ボタンはメタフィールドのみ反映。
  - ビルダー保存ボタンは `uploadingCover || uploadingFile` の間 disabled
  - 進捗 UI: `Loader2` スピナー + 「アップロード中…」(プログレスバーは P2 候補)
  - 完了表示: ファイル名 + サイズ + 緑チェック + 「差し替える」ボタン
  - エラー: inline 赤文字 + リトライ
  - 削除 UI なし(差し替えのみ)
- **Q10 / J-all-推奨 — MVP 最小範囲**:
  - `publishSchema` は変更しない(`file_path` / `cover_path` 任意)
  - drag&drop / progress bar / 自動リトライ / beforeunload 警告 / アップロードキャンセル は全て MVP 範囲外(P2 候補)
  - signed upload URL TTL は意図 5 分(SDK 仕様で実 TTL ~2h)、クライアントには `expiresIn: 300` を hint として返す
  - アクセシビリティ: `<input type="file">` 標準のみ(カスタムボタン化しない)
  - テスト: 純関数のみ Vitest(Ph-β 18 ケース)

**実装フェーズ分割**:
- **Ph-α**: migration `0007_storage_rls.sql` + README §6.3 にバケット設定手順
- **Ph-β**: `lib/format/upload.ts`(純関数 + サイズ定数)+ `tests/format/upload.test.ts`
- **Ph-γ**: `lib/access/upload-access.ts` + `lib/storage/signed-upload-url.ts` + `lib/mutations/product-paths.ts` + 2 Route Handler
- **Ph-δ**: `components/builder/upload-cover.tsx` + `upload-product-file.tsx` + `builder-form.tsx` の `#files` セクション置換
- **Ph-ε**: ACCEPTANCE / decisions / README / P2 Backlog / `check-server-only.mjs` の整合
- **追加 hotfix**: migration `0008_grant_products_update.sql`(Ph-γ 適用前に products UPDATE GRANT が漏れていたため追記。F-1 経路の DB UPDATE が permission denied で 500 を踏む問題を解消)
- **追加 hotfix**: migration `0009_grant_product_tags_writes.sql`(0006 で SELECT のみ付与され INSERT / DELETE が漏れていたため追記。`replaceTags()` の delete+insert が permission denied で silent failure になり、`updateMyProduct` / `createMyProduct` が成功扱いで返るにもかかわらずタグが 1 行も書かれない問題を解消。`replaceTags` が `console.error` でログするだけで throw しない設計は据え置き — Phase 9 で RPC 化する際に再評価する)

**運用上の注意(α版時点)**:
- `product-files` バケットの `Max file size` は **暫定 50 MB**(Free プラン制約、H-005 で Pro 移行手順を管理)
- `signed-upload-url.ts` は `createSignedUploadUrl(path, { upsert: true })` のみで `expiresIn` を渡さない(SDK 非対応、JSON レスポンスでのみクライアントに意図を伝達)
- ビルダーで `fileFormat` を変更直後にアップロードすると、サーバーが DB の旧 `file_format` と比較して 400 invalid_mime を返す。UI 側で「先に下書き保存してから添付」のヒントテキストで案内

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
- **現状(暫定)**: 表紙画像 10MB、作品ファイル **暫定 50MB**(コード側 `PRODUCT_FILE_MAX_BYTES` 反映済)
- **作品ファイル 50MB の根拠**: Supabase **Free プラン** のストレージ / egress 制限に合わせた暫定値。**本番前に Pro プランへ移行し、200MB に引き上げる予定**。引き上げ時は:
  1. `lib/format/upload.ts` の `PRODUCT_FILE_MAX_BYTES` を `200 * 1024 * 1024` に変更
  2. Supabase Studio で `product-files` バケットの `Max file size` を `209715200` に変更
  3. README §6.3 の表を 200 MB 表記に戻す
  4. 関連テスト(`tests/format/upload.test.ts`)の期待値を 200MB に更新
- **未決**: 実際のクリエイターのユースケースから再調整(MVP 運用後)
- **対応**: Phase 5 でクリエイター候補にヒアリング(α版運用後に実値で再評価)

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

---

## 6. 概念整理(将来用)

### C-001 bundle-only / asset の概念整理
α版の products テーブルは「1 product = 1 販売単位 = 1 配布物」を暗黙の前提に設計している。
将来 asset marketplace(個別アセット単位の販売)を入れる場合、この前提を分解する必要がある。

**現状(α版)**
- `products` 1行 = 購入単位 + 配布ファイル(`file_path`)1個
- 「bundle-only」モード(明示的な kind 列はないが、運用上 bundle のみ)

**将来の選択肢**
- **案A**: `products.kind = 'bundle' | 'asset'` カラムを追加して同テーブル内で区別
  - 単純。既存ロジックの変更が小さい
  - `asset` 同士の組み合わせ販売を表現するには別途中間表が必要
- **案B**: `bundles` / `assets` テーブルに分割、`bundle_assets` 中間表
  - 拡張性が高い
  - 既存 `products` 参照箇所の置き換えが多い

**前提**
- α版運用フィードバック前に着手しない
- 着手時は P2 Backlog の B-4 に正式エントリを起こす(現状はメモのみ)

---

## 7. P2 Backlog

α版受け入れ後の作業候補。**会話の中ですでに俎上に上がったもの限定**。
新規スコープはここに追加せず、別チケットで起こすこと。

各項目: [優先度] / [経緯] / [内容] / [依存] / [工数感]。

### 7.1 Now(α版運用開始後すぐに着手する候補)

| ID | 項目 | 経緯 | 内容 | 依存 | 工数感 |
|---|---|---|---|---|---|

*(現状: 該当項目なし。直前まで Now にあった B-1 は完了、§7.4 に移動。新規 Now 項目は α版運用フィードバックを受けて追加する想定。)*

### 7.2 Next(α運用フィードバックを取り込んでから着手)

| ID | 項目 | 経緯 | 内容 | 依存 | 工数感 |
|---|---|---|---|---|---|
| B-2 | admin 監査ログ閲覧 UI | Phase 8 の最終報告で「現状 Supabase Studio で参照」と確定 | `/admin/logs` 一覧 / フィルタ(action / target_type / 期間) / ページネーション。書き込みは引き続き RPC のみ | なし | 小 |
| B-6 | パスワードリセット UI | Phase 3 で対象外と確定 | `/forgot-password` / `/reset-password`、Supabase Auth `resetPasswordForEmail` 連携 | なし | 小 |
| B-7 | ビルダーの自動保存 | Phase 5 設計で「Phase 5 補強 or 後続」 | debounce 2 秒の Server Action、最終保存タイムスタンプ表示 | なし | 小 |

### 7.3 Later(構想段階。実装着手前に再評価必要)

| ID | 項目 | 経緯 | 内容 | 必要な前準備 | 工数感 |
|---|---|---|---|---|---|
| B-4 | asset marketplace | 会話初期で「将来構想」として言及 | 個別アセット単位の販売、bundle と asset の同居 | C-001 の「bundle-only / asset 概念整理」を正式設計に昇格、products テーブル構造の再設計、ストア UI の購入単位再設計 | 大 |
| B-5 | AI 補助プレイのプリペイドポイント課金 | 会話初期で「将来設計」として言及 | ユーザーごとの残高、AI アクション単位の消費、Stripe Checkout で残高チャージ | `balances` テーブル設計、消費トランザクション、AI 機能本体の存在(現状なし) | 大 |
| B-8 | アップロード UX 段階拡張 | D-019 Q10 で MVP 範囲外と確定した項目群 | drag&drop / progress bar(XHR `progress` 経由)/ アップロードキャンセル(AbortController)/ 自動リトライ / `beforeunload` 警告。**1 タスクとしてまとめずに、運用で詰まったものから個別に切り出す** | なし(独立) | 小〜中 |
| B-9 | 孤立ファイルクリーンアップ | D-019 Q5 / H-005 で MVP は放置と確定 | 拡張子変更時の旧 path、suspended/削除済 products の Storage オブジェクト等、DB から参照されなくなったファイルの定期削除ジョブ | DB 上のリファレンス整合チェック設計、Supabase Edge Functions or Cron | 中 |
| B-10 | `publishSchema` 強化(`file_path` 必須化) | D-019 Q10 で MVP は変更しないと確定 | publish 時に `products.file_path` 設定済を必須にする。クリエイター UX(「準備中のまま公開する」運用の可否)と合わせて判断 | クリエイター候補の運用ヒアリング | 小 |
| B-11 | ビルダー編集画面の `hasFile` / `coverPath` 初期表示 | Ph-δ 完了報告で「初期描画時に既登録ファイルを表示できない」と確定 | `MyProductDetail` に `hasFile` boolean と `coverPath` を含め、`UploadCover` / `UploadProductFile` が初期状態から「登録済み」表示を出せるようにする | `lib/queries/creator-products.ts` の `MyProductDetail` 型拡張、edit page → BuilderForm へ props 渡し | 小 |
| B-12 | レガシー MIME variant 受容 | D-019 Q8 / 各 Ph-β テストで意図的除外と確定 | `application/x-zip-compressed`(レガシー IE/Edge)、`audio/x-wav` 等を許可リストに追加。Supabase バケット設定の `allowed_mime_types` も同時に拡張 | ACCEPTANCE で実際に拒否事例が出てから判断 | 小 |

### 7.4 完了済(参照のみ)

| ID | 項目 | 完了経緯 |
|---|---|---|
| B-1 | `charge.refunded` webhook 本実装 | **完了**。Stripe の `charge.refunded` を受け取り → PaymentIntent から Checkout Session を逆引き → `purchases.status='refunded'` + `refunded_at` を冪等 UPDATE。`canDownload` に `refunded` reason 分岐を追加し、返金後の DL を 403 で拒否。実装は `lib/stripe/webhook.ts`(`decideRefundOutcome` / `handleChargeRefunded`)+ `lib/mutations/purchases.ts`(`markPurchaseRefunded`)+ `app/api/stripe/webhook/route.ts` の dispatch。テストは `tests/stripe/refund-outcome.test.ts`(8 ケース)。**MVP は full refund のみ反映、partial は意図的に skip**(D-016 / D-019 の方針継承) |
| B-3 | 表紙画像 / 作品ファイルアップロード UI | **完了**。Phase α〜ε(D-019 参照)で実装。`/creator/products/[id]/edit` の「ファイル添付」セクションで cover / file を builder UI からアップロード可能。Storage RLS は migration `0007_storage_rls.sql`、テーブル GRANT は `0008_grant_products_update.sql`(products UPDATE)/ `0009_grant_product_tags_writes.sql`(product_tags INSERT・DELETE)で補填済 |

### 7.5 整理ルール

- **Now に項目がある場合は、それらが完了するまで Next / Later には手を付けない**(現状 Now は空)
- α版運用前は Now すら本実装しない(ドキュメント確定のみ)
- B-4 / B-5 は MVP の自然な延長ではない。**運用実績ゼロの状態で着手しないこと**
- 既存項目に新スコープを足したくなったら、まず元の経緯を decisions.md で確認する
- 完了した項目は §7.4 に移し、削除しない(運用履歴として残す)
- 完了した項目は §7.4 に移し、削除しない(運用履歴として残す)
