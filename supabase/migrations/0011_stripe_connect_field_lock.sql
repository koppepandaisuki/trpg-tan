-- =====================================================================
-- 0011_stripe_connect_field_lock.sql
--
-- D-020 PR2 / Stripe Connect 関連列の改ざん防止。
--
-- profiles に追加された stripe_account_id / stripe_charges_enabled は
-- 「サーバー側(service_role)からのみ書き込み可」が前提:
--   - stripe_account_id        … onboarding-link Route Handler が Stripe accounts.create 直後に書く
--   - stripe_charges_enabled   … account.updated webhook が同期する
--
-- 既存の profiles UPDATE RLS は本人が自分の行を更新できる設計(display_name 等)。
-- 列単位の GRANT/REVOKE では細分管理が増えるため、BEFORE UPDATE トリガで
-- 「authenticated クライアント経由ではこの 2 列を変更できない」を担保する。
--
-- 判定:
--   - auth.uid() IS NULL  -> service_role(JWT 無し)。素通り
--   - auth.uid() IS NOT NULL かつ いずれかの列が変更された -> 42501 で拒否
--
-- 影響:
--   - 既存の display_name / bio / avatar_path の本人更新は無影響
--   - Supabase admin RPC(SECURITY DEFINER)も auth.uid() を持つが、それらは
--     Connect 列に触らない(0003 で定義済の admin_grant_creator 等は別列のみ更新)
-- =====================================================================

create or replace function public.profiles_lock_stripe_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role / Supabase admin client: no JWT, no auth.uid()
  if auth.uid() is null then
    return new;
  end if;

  if new.stripe_account_id is distinct from old.stripe_account_id then
    raise exception
      'profiles.stripe_account_id is managed server-side and cannot be updated by client'
      using errcode = '42501';
  end if;

  if new.stripe_charges_enabled is distinct from old.stripe_charges_enabled then
    raise exception
      'profiles.stripe_charges_enabled is managed server-side and cannot be updated by client'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_lock_stripe_fields_trigger on public.profiles;
create trigger profiles_lock_stripe_fields_trigger
  before update on public.profiles
  for each row execute function public.profiles_lock_stripe_fields();
