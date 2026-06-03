-- =====================================================================
-- 0016_product_reviews.sql
-- Steam ライクの「高評価 / 低評価」レビュー機能(LLL の Steam 化)
--
-- 仕様:
--   - 1 ユーザーは 1 商品につき 1 レビューだけ持てる(UNIQUE 制約)
--   - rating は 'positive' / 'negative' のバイナリ(Steam 同様)
--   - comment は任意、最大 2000 字
--   - 投稿条件: その商品を購入済み(paid)であること(RLS)
--   - 編集: 自分のレビューのみ
--   - 削除: 自分のレビューのみ
--   - 読み取り: 誰でも可(公開作品のレビューは公開情報)
--
-- 集計は Server 側で行う(別途 lib/queries/reviews.ts)。本 migration では
-- 純粋にテーブル + RLS + GRANT のみ。
--
-- 列挙攻撃 / spam 防止については α 期間中は最小限とし、Phase 2 で:
--   - スパム検出
--   - 通報フロー
--   - 一定期間内の編集制限
-- を追加する想定。
-- =====================================================================


-- ---------------------------------------------------------------------
-- テーブル
-- ---------------------------------------------------------------------
create table public.product_reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  rating      text not null check (rating in ('positive', 'negative')),
  comment     text not null default '' check (char_length(comment) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- 1 user × 1 product = 1 review
  unique (product_id, user_id)
);

create index product_reviews_product_idx
  on public.product_reviews (product_id, created_at desc);
create index product_reviews_user_idx
  on public.product_reviews (user_id);

create trigger product_reviews_set_updated_at
  before update on public.product_reviews
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.product_reviews enable row level security;

-- 誰でも読み取り可能(公開作品のレビューを表示する用途)
create policy "product_reviews_select_all"
  on public.product_reviews for select
  using (true);

-- 購入済み(paid)のユーザーのみ書き込み可能
-- user_id は本人 + その商品の paid purchase が存在することを要求
create policy "product_reviews_insert_purchased"
  on public.product_reviews for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.purchases
      where purchases.product_id = product_reviews.product_id
        and purchases.user_id    = auth.uid()
        and purchases.status     = 'paid'
    )
  );

-- 自分のレビューだけ更新可能
create policy "product_reviews_update_own"
  on public.product_reviews for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 自分のレビューだけ削除可能
create policy "product_reviews_delete_own"
  on public.product_reviews for delete to authenticated
  using (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- GRANT
-- ---------------------------------------------------------------------
grant select on public.product_reviews to anon, authenticated;
grant insert, update, delete on public.product_reviews to authenticated;
