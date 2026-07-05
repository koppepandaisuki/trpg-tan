-- =====================================================================
-- 0046_anomaly_report.sql
-- 運営向け異常検知の集計 RPC(日次ダイジェスト用)。
--
-- 直近 p_hours 時間のゴールド活動・リデーム状況を jsonb で返す。
-- Vercel Cron が /api/cron/anomaly-check を叩き、service_role でこの関数を
-- 呼んで Discord にダイジェストを流す(lib/security/anomaly.ts)。
--
-- 注記:
--   - kind='purchase' は買い手(amount<0)と作者(amount>0)の双方で使われるため、
--     バルク購入フラグは amount<0 で絞る(買い手の購入回数)。
--   - リデームは gold_transactions に載らない経路があるため code_redemptions で数える。
--   - service_role 専用(集計は全ユーザー横断のため)。
-- =====================================================================

create or replace function public.anomaly_report(p_hours integer default 24)
returns jsonb
language sql
security definer
set search_path = public, pg_catalog
as $$
  with win as (
    select now() - make_interval(hours => greatest(1, p_hours)) as since
  ),
  gk as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('kind', kind, 'cnt', cnt, 'total', total)
        order by total desc
      ), '[]'::jsonb) as j
    from (
      select gt.kind, count(*)::int as cnt, sum(abs(gt.amount))::int as total
      from public.gold_transactions gt, win
      where gt.created_at >= win.since
      group by gt.kind
    ) s
  ),
  rd as (
    select count(*)::int as total
    from public.code_redemptions cr, win
    where cr.created_at >= win.since
  ),
  tc as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('code', code, 'users', users)
        order by users desc
      ), '[]'::jsonb) as j
    from (
      select cr.code, count(distinct cr.user_id)::int as users
      from public.code_redemptions cr, win
      where cr.created_at >= win.since
      group by cr.code
      having count(distinct cr.user_id) >= 5
      order by users desc
      limit 10
    ) s
  ),
  fl as (
    select coalesce(jsonb_agg(f), '[]'::jsonb) as j
    from (
      -- AI 連打(1 ユーザー 100 回/window 以上)
      select jsonb_build_object('type', 'heavy_ai', 'user_id', user_id, 'cnt', cnt) as f
      from (
        select gt.user_id, count(*)::int as cnt
        from public.gold_transactions gt, win
        where gt.created_at >= win.since and gt.kind = 'ai_usage'
        group by gt.user_id having count(*) >= 100
      ) a
      union all
      -- 大量購入(買い手 amount<0 が 20 回/window 以上)
      select jsonb_build_object('type', 'bulk_purchase', 'user_id', user_id, 'cnt', cnt)
      from (
        select gt.user_id, count(*)::int as cnt
        from public.gold_transactions gt, win
        where gt.created_at >= win.since and gt.kind = 'purchase' and gt.amount < 0
        group by gt.user_id having count(*) >= 20
      ) b
      union all
      -- サンクス受取の集中(1 ユーザー 20,000G/window 以上)
      select jsonb_build_object('type', 'tip_concentration', 'user_id', user_id, 'total', total)
      from (
        select gt.user_id, sum(gt.amount)::int as total
        from public.gold_transactions gt, win
        where gt.created_at >= win.since and gt.kind = 'tip_received'
        group by gt.user_id having sum(gt.amount) >= 20000
      ) c
      union all
      -- コード漏洩の疑い(同一コードが 20 人以上に引き換えられた)
      select jsonb_build_object('type', 'code_leak', 'code', code, 'users', users)
      from (
        select cr.code, count(distinct cr.user_id)::int as users
        from public.code_redemptions cr, win
        where cr.created_at >= win.since
        group by cr.code having count(distinct cr.user_id) >= 20
      ) d
    ) s
  )
  select jsonb_build_object(
    'hours', greatest(1, p_hours),
    'gold_by_kind', (select j from gk),
    'redeems_total', (select total from rd),
    'top_codes', (select j from tc),
    'flags', (select j from fl)
  );
$$;

revoke all on function public.anomaly_report(integer) from public;
grant execute on function public.anomaly_report(integer) to service_role;
