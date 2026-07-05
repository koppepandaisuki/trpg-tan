-- =====================================================================
-- 0047_rate_limit_peek.sql
-- rate_limits(0044)を「増やさずに覗き見る」読み取り専用 RPC。
--
-- ログイン失敗のアカウントロック(lib/api/login-lockout.ts)で使う。
-- ログイン試行の前に「既にロック中か」を確認する必要があるが、
-- check_rate_limit は呼ぶだけでカウントが増えてしまうため、
-- 副作用のない peek 版を別に用意する。
-- =====================================================================

create or replace function public.rate_limit_peek(
  p_bucket         text,
  p_window_seconds integer
) returns integer
language sql
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (
      select case
        when window_start < now() - make_interval(secs => p_window_seconds) then 0
        else count
      end
      from public.rate_limits
      where bucket = p_bucket
    ),
    0
  );
$$;

revoke all on function public.rate_limit_peek(text, integer) from public;
grant execute on function public.rate_limit_peek(text, integer) to service_role;
