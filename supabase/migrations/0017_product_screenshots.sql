-- =====================================================================
-- 0017_product_screenshots.sql
-- 商品詳細にスクリーンショット(複数画像)を表示するためのテーブル +
-- screenshots Storage バケット作成。
--
-- 仕様:
--   - 1 商品につき最大 4 枚(アプリ側で制御、DB は CHECK 制約で 0–4 を担保)
--   - order_index で表示順を決定(0..3)
--   - path 形式: <creator_id>/<product_id>/<index>.<ext>
--   - 公開作品の screenshots は誰でも閲覧可
--   - creator 自身のみ自作品 screenshots を書き込み可能
--
-- 適用方法: Supabase Dashboard SQL Editor or `supabase db push`。
-- =====================================================================


-- ---------------------------------------------------------------------
-- テーブル
-- ---------------------------------------------------------------------
create table public.product_screenshots (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  order_index int  not null default 0 check (order_index >= 0 and order_index < 4),
  path        text not null check (char_length(path) <= 200),
  created_at  timestamptz not null default now(),

  unique (product_id, order_index)
);

create index product_screenshots_product_idx
  on public.product_screenshots (product_id, order_index);


-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.product_screenshots enable row level security;

-- 公開作品の screenshots は誰でも閲覧可。products.status='published' を JOIN で確認
create policy "product_screenshots_select_published"
  on public.product_screenshots for select
  using (
    exists (
      select 1 from public.products
      where products.id = product_screenshots.product_id
        and products.status = 'published'
    )
    -- creator 自身も自分の下書きの screenshots を見たい
    or exists (
      select 1 from public.products
      where products.id = product_screenshots.product_id
        and products.creator_id = auth.uid()
    )
  );

-- 自分の商品の screenshots だけ書き込み可能
create policy "product_screenshots_insert_own"
  on public.product_screenshots for insert to authenticated
  with check (
    exists (
      select 1 from public.products
      where products.id = product_screenshots.product_id
        and products.creator_id = auth.uid()
    )
  );

create policy "product_screenshots_update_own"
  on public.product_screenshots for update to authenticated
  using (
    exists (
      select 1 from public.products
      where products.id = product_screenshots.product_id
        and products.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.products
      where products.id = product_screenshots.product_id
        and products.creator_id = auth.uid()
    )
  );

create policy "product_screenshots_delete_own"
  on public.product_screenshots for delete to authenticated
  using (
    exists (
      select 1 from public.products
      where products.id = product_screenshots.product_id
        and products.creator_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------
-- GRANT
-- ---------------------------------------------------------------------
grant select on public.product_screenshots to anon, authenticated;
grant insert, update, delete on public.product_screenshots to authenticated;


-- ---------------------------------------------------------------------
-- screenshots Storage バケット作成
--   - public-read(誰でも閲覧可)
--   - 5 MB cap、画像形式のみ
--   - path: <creator_id>/<product_id>/<index>.{ext}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'screenshots',
  'screenshots',
  true,
  5 * 1024 * 1024,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public            = excluded.public,
  file_size_limit   = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ---------------------------------------------------------------------
-- Storage RLS(直接アップロード経路の二重防御)
-- path の第 1 セグメント = auth.uid() を要求(covers / avatars と同じ)
-- ---------------------------------------------------------------------
create policy "screenshots_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "screenshots_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "screenshots_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
