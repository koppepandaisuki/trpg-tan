-- =====================================================================
-- 0003_admin_rpc.sql
-- Phase 8 — admin 操作 + 監査ログを 1 トランザクションで実行する RPC
--
-- 設計方針:
--   - SECURITY DEFINER で auth.uid() を起点に admin 判定
--   - 状態変更と admin_audit_logs INSERT を同一関数内で実行(原子性)
--   - 監査ログが書けなければ本体変更も失敗する(トランザクション巻き戻し)
--   - SET search_path は public + pg_catalog に固定(SECURITY DEFINER のお作法)
--   - EXECUTE 権限は authenticated にのみ付与、anon / public は revoke
--   - 自分自身への is_creator 変更は禁止
--   - is_admin 付与/剥奪 RPC は意図的に作らない(DB 直接運用)
-- =====================================================================


-- ---------------------------------------------------------------------
-- admin_grant_creator(target_id)
--   profiles.is_creator = true + audit log
-- ---------------------------------------------------------------------
create or replace function public.admin_grant_creator(target_id uuid)
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

  select is_creator
    into before_value
    from public.profiles
   where id = target_id;

  if before_value is null then
    raise exception 'target not found';
  end if;

  update public.profiles
     set is_creator = true
   where id = target_id;

  insert into public.admin_audit_logs (
    admin_id, target_type, target_id, action, payload
  )
  values (
    caller_id,
    'profile',
    target_id::text,
    'grant_creator',
    jsonb_build_object(
      'before', jsonb_build_object('is_creator', before_value),
      'after',  jsonb_build_object('is_creator', true)
    )
  );
end;
$$;


-- ---------------------------------------------------------------------
-- admin_revoke_creator(target_id)
--   profiles.is_creator = false + audit log
--   既存作品はそのまま残す(指示通り、ここでは触らない)
-- ---------------------------------------------------------------------
create or replace function public.admin_revoke_creator(target_id uuid)
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

  select is_creator
    into before_value
    from public.profiles
   where id = target_id;

  if before_value is null then
    raise exception 'target not found';
  end if;

  update public.profiles
     set is_creator = false
   where id = target_id;

  insert into public.admin_audit_logs (
    admin_id, target_type, target_id, action, payload
  )
  values (
    caller_id,
    'profile',
    target_id::text,
    'revoke_creator',
    jsonb_build_object(
      'before', jsonb_build_object('is_creator', before_value),
      'after',  jsonb_build_object('is_creator', false)
    )
  );
end;
$$;


-- ---------------------------------------------------------------------
-- admin_set_product_status(product_id, new_status)
--   products.status を draft / published / suspended のいずれかに遷移。
--   published_at / suspended_at の整合性も同時に維持する。
--
--   - published 遷移: published_at が null なら now() を記録(初公開時)
--                     既に値があれば保持(再公開で初公開日を温存)
--   - suspended 遷移: suspended_at = now()
--   - draft 遷移:     suspended_at = null(停止中ではないことを明示)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_product_status(
  product_id  uuid,
  new_status  text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  caller_id            uuid := auth.uid();
  current_status       text;
  current_published_at timestamptz;
  next_published_at    timestamptz;
  next_suspended_at    timestamptz;
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

  if new_status not in ('draft', 'published', 'suspended') then
    raise exception 'invalid status: %', new_status;
  end if;

  select status, published_at
    into current_status, current_published_at
    from public.products
   where id = product_id;

  if current_status is null then
    raise exception 'product not found';
  end if;

  if current_status = new_status then
    -- 何も変わらないなら audit log も書かない
    return;
  end if;

  -- timestamps
  next_published_at := current_published_at;
  if new_status = 'published' and current_published_at is null then
    next_published_at := now();
  end if;

  if new_status = 'suspended' then
    next_suspended_at := now();
  else
    next_suspended_at := null;
  end if;

  update public.products
     set status       = new_status,
         published_at = next_published_at,
         suspended_at = next_suspended_at
   where id = product_id;

  insert into public.admin_audit_logs (
    admin_id, target_type, target_id, action, payload
  )
  values (
    caller_id,
    'product',
    product_id::text,
    'set_status:' || new_status,
    jsonb_build_object(
      'before', jsonb_build_object('status', current_status),
      'after',  jsonb_build_object('status', new_status)
    )
  );
end;
$$;


-- ---------------------------------------------------------------------
-- EXECUTE 権限
--   public / anon からは呼べない。authenticated だけが呼べる。
--   関数内で admin 判定するので、authenticated でも非 admin は raise exception で弾かれる。
-- ---------------------------------------------------------------------
revoke all on function public.admin_grant_creator(uuid)            from public;
revoke all on function public.admin_revoke_creator(uuid)           from public;
revoke all on function public.admin_set_product_status(uuid, text) from public;

grant execute on function public.admin_grant_creator(uuid)            to authenticated;
grant execute on function public.admin_revoke_creator(uuid)           to authenticated;
grant execute on function public.admin_set_product_status(uuid, text) to authenticated;
