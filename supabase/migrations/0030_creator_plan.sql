-- =====================================================================
-- 0030_creator_plan.sql
-- 料金プラン(基本/プロ)の土台。profiles.plan を追加する。
--
-- 用途:
--   - Pro は出品手数料を優遇(30% → 20%。lib/stripe/fees.ts)
--   - 将来の特典(日程調整 無制限 / クラウド保存 / 優先表示 等)の判定にも使う
--
-- 課金(Stripe Billing による月額徴収)は別実装。本 migration は判定用の列のみ。
-- 値の更新は当面 admin が行う(service_role での UPDATE もしくは将来の admin UI)。
-- 過去購入の分配額は purchases.application_fee_jpy にスナップショット済みなので、
-- プラン変更や手数料率変更があっても遡って影響しない。
-- =====================================================================

alter table public.profiles
  add column if not exists plan text not null default 'basic'
    check (plan in ('basic', 'pro'));

comment on column public.profiles.plan is
  '料金プラン: basic(無料) / pro(月額)。手数料率・特典の判定に使用。課金連携は別実装。';
