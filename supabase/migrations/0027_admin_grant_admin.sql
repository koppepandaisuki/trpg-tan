-- ---------------------------------------------------------------------
-- 0027_admin_grant_admin.sql
--
-- 既存 admin が他ユーザーに admin 権限を付与/剥奪できるようにする RPC を
-- 追加する。creator 用の admin_grant_creator / admin_revoke_creator と
-- 同じパターン(SECURITY DEFINER + admin_audit_logs に記録)。
--
-- 自分自身は変更できない(cannot modify self)。最初の admin は
-- alpha-admin.ts の bootstrap でメアドホワイトリスト経由でしか作れない。
-- ---------------------------------------------------------------------

create or replace function public.admin_grant_admin(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  caller_id    uuid := auth.uid();
  before_value boolean;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  if not exists (
    select 1 from public.profiles
     where id = caller_id and is_admin = true
  ) then
    raise exception 'forbidden';
  end if;

  if target_id = caller_id then
    raise exception 'cannot modify self';
  end if;

  select is_admin
    into before_value
    from public.profiles
   where id = target_id;

  if before_value is null then
    raise exception 'target not found';
  end if;

  update public.profiles
     set is_admin = true
   where id = target_id;

  insert into public.admin_audit_logs (
    admin_id, target_type, target_id, action, payload
  )
  values (
    caller_id,
    'profile',
    target_id::text,
    'grant_admin',
    jsonb_build_object(
      'before', jsonb_build_object('is_admin', before_value),
      'after',  jsonb_build_object('is_admin', true)
    )
  );
end;
$$;


create or replace function public.admin_revoke_admin(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  caller_id    uuid := auth.uid();
  before_value boolean;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  if not exists (
    select 1 from public.profiles
     where id = caller_id and is_admin = true
  ) then
    raise exception 'forbidden';
  end if;

  if target_id = caller_id then
    raise exception 'cannot modify self';
  end if;

  select is_admin
    into before_value
    from public.profiles
   where id = target_id;

  if before_value is null then
    raise exception 'target not found';
  end if;

  update public.profiles
     set is_admin = false
   where id = target_id;

  insert into public.admin_audit_logs (
    admin_id, target_type, target_id, action, payload
  )
  values (
    caller_id,
    'profile',
    target_id::text,
    'revoke_admin',
    jsonb_build_object(
      'before', jsonb_build_object('is_admin', before_value),
      'after',  jsonb_build_object('is_admin', false)
    )
  );
end;
$$;

-- 既存 RPC と同様、anon/authenticated には execute 権限を絞る
revoke all on function public.admin_grant_admin(uuid)  from public;
revoke all on function public.admin_revoke_admin(uuid) from public;
grant execute on function public.admin_grant_admin(uuid)  to authenticated;
grant execute on function public.admin_revoke_admin(uuid) to authenticated;
