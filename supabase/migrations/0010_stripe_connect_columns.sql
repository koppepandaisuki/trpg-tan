-- =====================================================================
-- 0010_stripe_connect_columns.sql
--
-- D-020 Stripe Connect (Express, destination charge, 30% fee) の器を用意する。
--
-- このマイグレーション単独ではアプリ挙動は変わらない:
--   - 新列はすべて NULL / false 許容(既存行を壊さない)
--   - 読み出し箇所はまだ存在しない(PR2 / PR3 で順次追加)
--
-- 列の責務:
--   profiles.stripe_account_id        Connect Express account の ID(creator のみ非 NULL)
--   profiles.stripe_charges_enabled   onboarding 完了済かどうか(account.updated webhook で同期、PR2)
--   purchases.application_fee_jpy     購入時点の 30% プラットフォーム取り分スナップショット
--                                      将来レート変更でも過去購入の分配が正しく残るように保存
--   purchases.creator_id              products.creator_id の購入時点スナップショット
--                                      creator 削除 / 将来の作品移譲を想定して購入時点を固定
--
-- GRANT / RLS:
--   テーブル GRANT は既存(0004 / 0006)のまま列単位ではないため新列も自動で対象。
--   profiles の `stripe_charges_enabled` をクライアント直接 UPDATE で改ざんさせない
--   ポリシー強化は PR2 で対応(現状は誰も UPDATE してこないため無害)。
-- =====================================================================

alter table public.profiles
  add column stripe_account_id text unique,
  add column stripe_charges_enabled boolean not null default false;

alter table public.purchases
  add column application_fee_jpy integer check (application_fee_jpy >= 0),
  add column creator_id uuid references public.profiles(id) on delete set null;

create index purchases_creator_id_status_idx
  on public.purchases (creator_id, status);
