-- 0035_product_discount_period.sql
--
-- 割引(セール)に期間を持たせる。discount_starts_at / discount_ends_at は任意。
--   両方 null          … 無期限セール(discount_percent が常に有効)
--   starts_at のみ      … その時刻以降に開始(終了なし)
--   ends_at のみ        … その時刻まで(即時開始)
--   両方                … 期間限定セール
-- 「今」が期間内のときだけ discount_percent が効く。期間外は定価に戻る。
-- 実効割引・実効価格はアプリ側(effectiveDiscountPercent / salePriceJpy)で算出。

alter table public.products
  add column if not exists discount_starts_at timestamptz,
  add column if not exists discount_ends_at timestamptz;

-- 終了は開始より後でなければならない(両方指定時のみ)。
alter table public.products
  drop constraint if exists products_discount_period_chk;
alter table public.products
  add constraint products_discount_period_chk
    check (
      discount_starts_at is null
      or discount_ends_at is null
      or discount_ends_at > discount_starts_at
    );
