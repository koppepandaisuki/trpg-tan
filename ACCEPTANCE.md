# α版受け入れチェックリスト

人間が α版を動作確認するときに、**この順で上から下へ実行**する。
途中のセクションが失敗したら、後ろは進めず原因を解消してから再開する。
詳しい手順は [README.md](README.md) の該当セクションを参照。

> このリストは「α版として通せば最低限の安全運用ができる」線を担保する。
> 受け入れ後のロードマップ(将来作業)は [decisions.md §7 P2 Backlog](decisions.md) を参照。

---

## A. ビルド / 静的検査 / テスト

| # | 手順 | 通過条件 |
|---|---|---|
| A-1 | `pnpm install` | エラー無し |
| A-2 | `pnpm typecheck` | エラー無し |
| A-3 | `pnpm lint` | エラー無し |
| A-4 | `pnpm test:run` | 全テスト pass(約70ケース) |
| A-5 | `pnpm build` | 成功(prebuild で `check:server-only` 自動実行) |
| A-6 | `pnpm check:secrets` | `.next/static/` に secret 名混入なし |

A-5 が失敗する場合のほとんどは、`use client` を持つファイルがサーバー専用モジュールを import している。エラーメッセージに修正手順あり。

---

## B. Supabase 受け入れ環境設定

| # | 手順 | 通過条件 |
|---|---|---|
| B-1 | Supabase プロジェクト作成 | URL / anon / service_role を控える |
| B-2 | `.env.local` に Supabase キーを設定 | 4キーすべて記入 |
| B-3 | `supabase/migrations/0001_initial_schema.sql` を SQL Editor で実行 | エラー無し |
| B-4 | `supabase/migrations/0002_rls_policies.sql` 実行 | エラー無し |
| B-5 | `supabase/migrations/0003_admin_rpc.sql` 実行 | エラー無し |
| B-6 | Storage で `covers` バケット作成(public read) | バケット作成済み |
| B-7 | Storage で `avatars` バケット作成(public read) | 〃 |
| B-8 | Storage で `product-files` バケット作成(**private**) | **read ポリシーを付けない** |
| B-9 | Authentication > URL Configuration の Site URL / Redirect URLs を設定 | `/auth/callback` がホワイトリスト |
| B-10 | テストユーザー作成: `alice` / `bob` / `carol` | 3 UUID を控える |
| B-11 | `update profiles set is_admin = true where id = '<carol-uuid>'` | admin 1名付与 |
| B-12 | (任意)`supabase/seed.sql` の UUID を差し替えて実行 | seed データ投入完了 |

---

## C. Stripe 受け入れ環境設定

| # | 手順 | 通過条件 |
|---|---|---|
| C-1 | Stripe テストモードの Secret key を `.env.local` の `STRIPE_SECRET_KEY` に設定 | キー設定済み |
| C-2 | 別ターミナルで `stripe listen --forward-to localhost:3000/api/stripe/webhook` を起動 | `whsec_...` が出力 |
| C-3 | C-2 で得た `whsec_...` を `.env.local` の `STRIPE_WEBHOOK_SECRET` に設定 | キー設定済み |
| C-4 | Stripe Dashboard の API version を `2024-06-20` に合わせる | コード側と一致 |
| C-5 | (D-020 PR2 以降)Stripe Dashboard で **Connect endpoint**(`connect: true`)を同じ URL `/api/stripe/webhook` に登録し、`account.updated` を購読。発行された別の `whsec_...` を `.env.local` の `STRIPE_CONNECT_WEBHOOK_SECRET` に設定 | キー設定済み・platform / Connect の 2 endpoint が同じ URL を指している |
| C-6 | `pnpm dev` を起動して `http://localhost:3000` が開ける | トップページ表示 |

---

## D. ロール別動作確認(未ログイン / 一般 user)

| # | 手順 | 通過条件 |
|---|---|---|
| D-1 | 未ログインで `/` `/store` `/store/<slug>` | 200 表示 |
| D-2 | 未ログインで `/library` `/creator/products` `/admin` | `/login?next=...` にリダイレクト |
| D-3 | 未ログインで `curl -X POST http://localhost:3000/api/library/<uuid>/download` | **401 JSON**(HTMLじゃない) |
| D-4 | `/signup` でユーザー新規登録 | 確認メール経由でログイン完了 |
| D-5 | ヘッダーに表示名 + ログアウトボタンが表示 | ✓ |
| D-6 | ログイン済み一般 user で `/creator/products` `/admin` | `/403` リダイレクト |
| D-7 | ログイン済みで `/login` `/signup` | `/` にリダイレクト |

---

## E. admin 動作確認

| # | 手順 | 通過条件 |
|---|---|---|
| E-1 | admin で `/admin` | タブナビ表示 |
| E-2 | `/admin/users` で別ユーザーに「creator 付与」 | バッジ「creator」が付く |
| E-3 | そのユーザーで再ログイン → `/creator/products` | 200(creator メニュー表示) |
| E-4 | admin で同ユーザーから「creator 剥奪」 | バッジが消える |
| E-5 | 剥奪されたユーザーで `/creator/products` | `/403` |
| E-6 | `/admin/users` で自分自身の行 | 操作ボタン非表示 / 「あなた」バッジ |
| E-7 | `/admin/products` で公開作品を「停止する」 | バッジ「停止中」に変化、`suspended_at` 記録 |
| E-8 | `/store` でその作品が消える | 一覧から除外 |
| E-9 | `/admin/products` で「公開に戻す」 | バッジ「公開中」、`/store` に復活 |
| E-10 | Supabase Studio で `select * from admin_audit_logs order by created_at desc limit 10` | E-2 / E-4 / E-7 / E-9 の操作が記録 |

---

## F. 決済 / library / 配布停止 確認

| # | 手順 | 通過条件 |
|---|---|---|
| F-1 | creator で `/creator/products/new` → 必須項目を入力して「下書き保存」 | `/creator/products/[id]/edit?saved=1` に遷移 |
| F-1.5 | 編集画面の「ファイル添付」セクション → **表紙画像 → 「ファイルを選択」** で PNG / JPEG / WebP(10 MB 以下)を選ぶ | 「アップロード中…」スピナー → 緑チェック + ファイル名 + サイズ表示。「差し替える」ボタン表示。Supabase Studio で `products.cover_path` が `<creator_id>/<product_id>.<ext>` 形式で設定済 |
| F-2 | 同画面で「公開して保存」 | 「保存しました」表示、`/store` で公開、**一覧カードに表紙画像が表示される** |
| F-3 | 別ユーザー(購入者)で `/store/[slug]` を開く | 「今すぐ購入」CTA、表紙画像が表示される |
| F-4 | 「今すぐ購入」 → Stripe Checkout → カード `4242 4242 4242 4242` で決済完了 | `/checkout/success` 表示 |
| F-5 | C-2 のターミナルに `checkout.session.completed` 受信ログ | webhook が反応している |
| F-6 | 数秒後に `/library` を更新 | 購入作品が表示される(現時点は「準備中」セクション — file_path 未設定のため) |
| F-7 | creator として再ログイン → `/creator/products/[id]/edit` の「ファイル添付」 → **作品ファイル → 「ファイルを選択」** で `products.file_format` に合うファイル(50 MB 以下)を選ぶ | 「アップロード中…」 → 緑チェック + ファイル名 + サイズ表示。`uploadingFile` の間は上部ツールバーの「下書き保存」「公開して保存」が **disabled** |
| F-8 | Supabase Studio で `select id, cover_path, file_path from public.products where id = '<product_id>';` | `cover_path` と `file_path` が両方とも `<creator_id>/<product_id>.<ext>` で設定済 |
| F-9 | 購入者として `/library` を再読み込み | 「利用可能」セクションに移動、DL ボタン活性 |
| F-10 | DL ボタンを押下 | 同一タブで Storage 署名URLに遷移、ファイル取得 |
| F-11 | 同じ作品で `/store/[slug]` を開き直す | CTA が「ライブラリで見る」に切替 |
| F-12 | 古いタブで `/store/[slug]` の BuyButton を再度押下 | inline error「すでに購入済みです」 |
| F-13 | admin で当該作品を「停止する」 | `/library` で「配布停止中」表示、DLボタン disabled |
| F-14 | `curl -X POST -H "Origin: http://localhost:3000" http://localhost:3000/api/library/<id>/download` (停止中) | 403 JSON、message は generic |
| F-15 | admin で「公開に戻す」 | `/library` で再び DL 可能 |
| F-16 | creator で `/creator/products/[id]/edit` のファイル添付 →「ファイルを選択」で **対応外の MIME**(例: `.gif`)を選ぼうとする | `<input accept>` で OS のファイルピッカーから弾かれる。または選択できても 400 JSON「対応していないファイル形式です」が inline 表示される |
| F-17 | 同セクションで MIME を強引に通した 60 MB のファイルを選ぶ(DevTools で `accept` を外す等) | クライアント早期 reject「ファイルサイズが上限(50 MB)を超えています」、または Supabase バケット設定で拒否 |

---

## G. セキュリティ最終確認

| # | 手順 | 通過条件 |
|---|---|---|
| G-1 | `git status` で `.env.local` が untracked | 環境ファイルが追跡対象外 |
| G-2 | 本番 env(Vercel 等)に `NEXT_PUBLIC_*_SECRET_*` のキー名が無い | 公開鍵プレフィックスに secret 無し |
| G-3 | DevTools の Network で `/api/library/<id>/download` の失敗レスポンス | `reason` / `not_purchased` / `suspended` / `file_path` などが含まれない |
| G-4 | 他人の作品 ID で `POST /api/checkout` | 404 JSON、message 一律 |
| G-5 | 自作品の ID で `POST /api/checkout` | 404 JSON(存在を漏らさない) |
| G-6 | 既購入で `POST /api/checkout` | 409 JSON、`reason: "already_purchased"`(明示でOK) |
| G-7 | `curl -X POST -H "Origin: http://evil.example" .../api/library/.../download` | 403 JSON「リクエストが拒否されました」 |
| G-8 | `curl -X POST .../api/stripe/webhook` (Stripe-Signature 無し) | 400 |
| G-9 | DevTools の Network で `/api/checkout` 成功時のリクエストペイロード | `productId` のみ、`price` / `title` が含まれない |
| G-10 | Supabase Studio の SQL Editor で `set role anon; select admin_grant_creator('<uuid>')` | EXECUTE 拒否 |
| G-11 | 非 admin の authenticated で同上 | `forbidden` exception |
| G-12 | Supabase Studio で `select id from purchases where stripe_session_id = '<seed>'` のあと、`delete from products where id = (...)` | 購入履歴がある作品は FK restrict で削除不可 |

---

## H. 受け入れ完了の宣言

A〜G すべて pass したら、α版受け入れ完了。

次のフェーズの計画は [decisions.md §7 P2 Backlog](decisions.md) を参照。
**α版運用フィードバックを取り終わるまで Now の項目以外には着手しない**。
