-- =====================================================================
-- 0032_plan_billing.sql
-- 月額プラン(play/pro)の Stripe サブスクリプション課金に必要な列を profiles に追加。
--
-- plan(basic/play/pro)は既存(0030/0031)。ここでは Stripe 連携の状態を持たせる:
--   - stripe_customer_id        … Stripe Customer ID(課金/ポータルの紐付け・再利用)
--   - plan_sub_id               … 現在のサブスクリプション ID(active のとき)
--   - plan_status               … サブスクの状態(active/trialing/past_due/canceled 等)
--   - plan_current_period_end   … 現在の課金期間の終了時刻(解約予約の表示に使う)
--
-- 付与/剥奪は Stripe webhook(customer.subscription.*) が admin client(service_role)
-- 経由で profiles.plan を更新する。owner は自分の行を読めるので追加ポリシーは不要。
--
-- 適用方法: Supabase Dashboard SQL Editor or `supabase db push`。再実行安全。
-- =====================================================================

alter table public.profiles
  add column if not exists stripe_customer_id        text,
  add column if not exists plan_sub_id               text,
  add column if not exists plan_status               text,
  add column if not exists plan_current_period_end   timestamptz;

-- webhook が customer 経由でユーザーを引くため索引を張る。
create index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id);
