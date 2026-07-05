-- 0034_product_discount.sql
--
-- 作品ごとの割引(セール)。discount_percent は 0..100 の整数。
--   0   … 割引なし(定価)
--   1-99… 値引き。実効価格 = round(price_jpy * (100 - discount_percent) / 100)
--   100 … 実質無料配布(実効価格 0 → 決済は無料DLフローに乗り Stripe をスキップ)
--
-- 価格自体(price_jpy)は据え置き、割引率だけ別カラムに持たせることで「定価の
-- 取り消し線 + 割引後価格」を表示でき、セールの開始/終了は discount_percent の
-- 変更だけで済む(期間指定は将来必要になったら別カラムで足す)。

alter table public.products
  add column if not exists discount_percent integer not null default 0
    check (discount_percent between 0 and 100);
