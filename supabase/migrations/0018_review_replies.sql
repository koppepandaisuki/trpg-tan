-- =====================================================================
-- 0018_review_replies.sql
-- レビューに creator(商品の作者)が公式返信できる機能。Steam の
-- "Developer's Response" 相当。
--
-- 仕様:
--   - 1 レビューにつき 1 返信(UNIQUE(review_id))
--   - 返信できるのは商品の creator 本人のみ(RLS で担保)
--   - body は最大 2000 字
--   - レビュー自体が削除されたら返信も cascade で削除
-- =====================================================================


-- ---------------------------------------------------------------------
-- テーブル
-- ---------------------------------------------------------------------
create table public.review_replies (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.product_reviews(id) on delete cascade,
  creator_id  uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) > 0 and char_length(body) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (review_id)
);

create index review_replies_review_idx  on public.review_replies (review_id);
create index review_replies_creator_idx on public.review_replies (creator_id);

create trigger review_replies_set_updated_at
  before update on public.review_replies
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.review_replies enable row level security;

-- 誰でも読み取り可能(公開作品のレビュー返信を表示する用途)
create policy "review_replies_select_all"
  on public.review_replies for select
  using (true);

-- creator は「自分が作った商品のレビュー」にだけ返信できる
create policy "review_replies_insert_creator"
  on public.review_replies for insert to authenticated
  with check (
    creator_id = auth.uid()
    and exists (
      select 1
      from public.product_reviews pr
      join public.products p on p.id = pr.product_id
      where pr.id = review_replies.review_id
        and p.creator_id = auth.uid()
    )
  );

-- 自分の返信のみ更新可能
create policy "review_replies_update_own"
  on public.review_replies for update to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

-- 自分の返信のみ削除可能
create policy "review_replies_delete_own"
  on public.review_replies for delete to authenticated
  using (creator_id = auth.uid());


-- ---------------------------------------------------------------------
-- GRANT
-- ---------------------------------------------------------------------
grant select on public.review_replies to anon, authenticated;
grant insert, update, delete on public.review_replies to authenticated;
