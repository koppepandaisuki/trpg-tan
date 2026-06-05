-- =====================================================================
-- 0019_review_votes.sql
-- レビューへの「役に立った」投票(LLLLL)。Steam / Amazon の
-- "Was this review helpful?" 相当。
--
-- 仕様:
--   - 1 ユーザーは 1 レビューにつき 1 票(UNIQUE(review_id, user_id))
--   - 投票はログインユーザーのみ
--   - 自分のレビューにも投票できる(制限しない。α 期間は最小実装)
--   - レビューが削除されたら投票も cascade で削除
-- =====================================================================


-- ---------------------------------------------------------------------
-- テーブル
-- ---------------------------------------------------------------------
create table public.review_votes (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.product_reviews(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),

  unique (review_id, user_id)
);

create index review_votes_review_idx on public.review_votes (review_id);
create index review_votes_user_idx   on public.review_votes (user_id);


-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.review_votes enable row level security;

-- 誰でも読み取り可能(集計表示のため)
create policy "review_votes_select_all"
  on public.review_votes for select
  using (true);

-- 認証ユーザーは自分名義の投票のみ追加可能
create policy "review_votes_insert_own"
  on public.review_votes for insert to authenticated
  with check (user_id = auth.uid());

-- 自分の投票のみ削除可能(toggle off)
create policy "review_votes_delete_own"
  on public.review_votes for delete to authenticated
  using (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- GRANT
-- ---------------------------------------------------------------------
grant select on public.review_votes to anon, authenticated;
grant insert, delete on public.review_votes to authenticated;
