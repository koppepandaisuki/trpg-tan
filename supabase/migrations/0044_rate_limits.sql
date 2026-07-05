-- =====================================================================
-- 0044_rate_limits.sql
-- サーバ側レートリミット(乱用・総当たり・コスト攻撃の抑制)。
--
-- 設計:
--   - bucket(例 "redeem:<uid>" / "ai:<uid>")ごとの固定ウィンドウ・カウンタ。
--   - check_rate_limit は 1 回の upsert で「加算 or ウィンドウ更新」を原子的に行い、
--     加算後カウントが limit 以下なら true(許可)、超過なら false(拒否)を返す。
--   - service_role 専用(route handler が admin client 経由で呼ぶ)。RLS 有効化 +
--     ポリシー無しで authenticated/anon からは一切触れない(service_role は RLS バイパス)。
--
-- 注記:
--   - 固定ウィンドウなのでウィンドウ境界での瞬間バーストは最大 2 倍まで許容するが、
--     総当たり・スパム・コスト攻撃の抑制には十分。厳密なスライディングが必要なら後日 Upstash 等へ。
--   - 行は bucket ごとに 1 行(ユーザー数 × エンドポイント数で上界)。使い回されるので肥大しない。
-- =====================================================================

create table if not exists public.rate_limits (
  bucket       text primary key,
  count        integer not null default 0,
  window_start timestamptz not null default now()
);

alter table public.rate_limits enable row level security;
-- ポリシーは意図的に作らない = authenticated/anon は全拒否。service_role のみ RPC 経由。

create or replace function public.check_rate_limit(
  p_bucket         text,
  p_limit          integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_now   timestamptz := now();
  v_count integer;
begin
  insert into public.rate_limits as rl (bucket, count, window_start)
  values (p_bucket, 1, v_now)
  on conflict (bucket) do update
    set count = case
          when rl.window_start < v_now - make_interval(secs => p_window_seconds)
            then 1
          else rl.count + 1
        end,
        window_start = case
          when rl.window_start < v_now - make_interval(secs => p_window_seconds)
            then v_now
          else rl.window_start
        end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
