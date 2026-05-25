-- purchases: authenticated can SELECT, service_role handles INSERT via webhook
grant select on public.purchases to authenticated;

-- product_tags: anyone authenticated can SELECT
grant select on public.product_tags to authenticated;