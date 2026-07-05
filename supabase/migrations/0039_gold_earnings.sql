-- 0039_gold_earnings.sql
--
-- クリエイター収益ダッシュボード用の集計 RPC。
--   gold_transactions のうち、本人が「受け取った」正の取引だけを合算する:
--     kind='purchase'      … 作品のゴールド売上(手数料差引後の付与ぶん)
--     kind='tip_received'  … スーパーサンクスの受領
--   (作品を「買った」側の purchase 行は amount<0 なので自然に除外される)
--
-- security definer だが auth.uid() のみを対象にするため、他人の収益は見えない
-- (gold_transactions の RLS と同じ範囲)。現金化はできない。

create or replace function public.gold_earnings()
returns table (
  total_sales integer,   -- 作品のゴールド売上(受取ぶん)
  total_tips  integer,   -- スーパーサンクス受領
  supporters  integer    -- サンクスをくれた延べ取引数
)
language sql security definer set search_path = public stable as $$
  select
    coalesce(sum(amount) filter (where kind = 'purchase'), 0)::integer,
    coalesce(sum(amount) filter (where kind = 'tip_received'), 0)::integer,
    count(*) filter (where kind = 'tip_received')::integer
  from public.gold_transactions
  where user_id = auth.uid() and amount > 0;
$$;

revoke all on function public.gold_earnings() from public;
grant execute on function public.gold_earnings() to authenticated, service_role;
