-- =====================================================================
-- 0043_admin_adjust_gold.sql
-- 運営用ゴールド調整 RPC(問い合わせ対応 — 付与/減算どちらも可)。
--
-- 0003_admin_rpc.sql と同じ設計方針を踏襲:
--   - SECURITY DEFINER で auth.uid() を起点に admin 判定
--   - 残高更新 + gold_transactions(kind='admin') + admin_audit_logs を
--     同一トランザクションで実行(原子性)
--   - 自分自身への適用は禁止
--   - 減算で残高がマイナスになる場合は拒否(insufficient_balance)
-- =====================================================================

create or replace function public.admin_adjust_gold(
  target_id uuid,
  amount    integer,
  note      text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  caller_id      uuid := auth.uid();
  before_balance integer;
  after_balance  integer;
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

  if amount is null or amount = 0 then
    raise exception 'invalid_amount';
  end if;

  select gold_balance
    into before_balance
    from public.profiles
   where id = target_id;

  if before_balance is null then
    raise exception 'target not found';
  end if;

  if before_balance + amount < 0 then
    raise exception 'insufficient_balance';
  end if;

  update public.profiles
     set gold_balance = gold_balance + amount
   where id = target_id
  returning gold_balance into after_balance;

  insert into public.gold_transactions (user_id, amount, kind, ref_id, note)
  values (target_id, amount, 'admin', null, note);

  insert into public.admin_audit_logs (
    admin_id, target_type, target_id, action, payload
  )
  values (
    caller_id,
    'profile',
    target_id::text,
    'adjust_gold',
    jsonb_build_object(
      'before', jsonb_build_object('gold_balance', before_balance),
      'after',  jsonb_build_object('gold_balance', after_balance),
      'amount', amount,
      'note',   note
    )
  );

  return after_balance;
end;
$$;

revoke all on function public.admin_adjust_gold(uuid, integer, text) from public;
grant execute on function public.admin_adjust_gold(uuid, integer, text) to authenticated;
