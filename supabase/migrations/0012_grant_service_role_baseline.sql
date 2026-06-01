-- =====================================================================
-- 0012_grant_service_role_baseline.sql
--
-- B-17: service_role が public スキーマのテーブルに対して DML 権限を
-- 持つことを保証する baseline migration。
--
-- 経緯:
--   D-020 PR3 の動作検証中、Stripe Connect onboarding-link Route Handler
--   が `attachStripeAccountId` 経由で profiles.stripe_account_id を書き込
--   もうとして `permission denied for table profiles` で落ちた。
--   Supabase の "service_role" は通常 BYPASSRLS + 全テーブル DML 権限を
--   デフォルトで持つはずだが、このプロジェクトでは何らかの理由で付与
--   されていなかった(新しめのプロジェクトテンプレート挙動か、過去の
--   REVOKE か原因は不明)。
--
--   本番では即時補填の手動 SQL で凌いだが、新環境構築・staging 構築・
--   開発者参加時にも同じ落とし穴を踏むため、正式 migration として
--   repo に固定する。
--
-- 影響:
--   - webhook(upsertPurchaseFromSession / markPurchaseRefunded /
--     syncCreatorChargesEnabled / attachStripeAccountId)が service_role
--     経由で安全に書き込める
--   - admin RPC は SECURITY DEFINER で動くため別経路で、本 migration の
--     影響は受けない
--   - RLS は引き続き有効。service_role は BYPASSRLS なので read/write は
--     RLS 評価をスキップする(これは Supabase 標準の意図された挙動)
--
-- 冪等性:
--   既に同じ GRANT が当たっている本番では何もしない(no-op)。
--   alter default privileges も上書きで安全。
-- =====================================================================

-- 既存テーブル全部に対する DML 権限
grant select, insert, update, delete
  on all tables in schema public
  to service_role;

-- 今後 public スキーマに新規追加されるテーブルにも自動付与
-- (postgres ロールがテーブルを作る場合の default privileges を設定)
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
