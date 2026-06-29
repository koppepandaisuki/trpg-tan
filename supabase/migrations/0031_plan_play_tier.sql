-- =====================================================================
-- 0031_plan_play_tier.sql
-- 料金プランを 3 段階に拡張: basic / play / pro。
--
--   - play(¥500): PLAY(卓のホスト・全機能)を解放する中間プラン。
--   - 出品手数料の優遇は引き続き Pro のみ(play は遊ぶ人向け)。
--
-- 0030 で付けた CHECK(basic/pro)を張り替える。constraint 名は Postgres の
-- 既定(<table>_<column>_check)。drop if exists で 0030 適用済/未適用どちらでも
-- 安全に通る。
-- =====================================================================

alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
    check (plan in ('basic', 'play', 'pro'));

comment on column public.profiles.plan is
  '料金プラン: basic(無料) / play(¥500・PLAY解放) / pro(¥980・全部+手数料優遇)。課金連携は別実装。';
