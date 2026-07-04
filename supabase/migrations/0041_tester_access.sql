-- 0041_tester_access.sql
--
-- テスター権限。リデームコード「TESTER」を入力すると profiles.is_tester = true
-- になり、Stripe を介さずに月額プラン(play/pro)を無料で切り替えられるようになる
-- (/api/account/plan の setUserPlanTester 直呼び経路が isTester にも開放される)。
--
-- 正式リリース時にコードを止めるには、以下のどちらかを実行する:
--   update public.redeem_codes set expires_at = now() where code = 'TESTER';
--   delete from public.redeem_codes where code = 'TESTER';
-- (既に is_tester=true 済みのユーザーからは剥奪されない。剥奪する場合は
--   update public.profiles set is_tester = false; を別途実行)

alter table public.profiles
  add column if not exists is_tester boolean not null default false;

-- kind の CHECK 制約に 'tester_access' を追加(既存値は維持)。
alter table public.redeem_codes drop constraint if exists redeem_codes_kind_check;
alter table public.redeem_codes
  add constraint redeem_codes_kind_check check (kind in (
    'plan_play', 'plan_pro', 'gold', 'tester_access'
  ));

-- 配布コード本体。max_uses は多めに確保(クローズドテスト規模なら十分)。
insert into public.redeem_codes (code, kind, amount, max_uses, expires_at, note)
values (
  'TESTER',
  'tester_access',
  0,
  9999,
  null,
  'クローズドテスト配布用。正式リリース前に無効化/削除すること。'
)
on conflict (code) do nothing;
