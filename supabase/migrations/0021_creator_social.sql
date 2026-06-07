-- =====================================================================
-- 0021_creator_social.sql
-- クリエイターの「フォロー」(SNS 的・DB 永続)と、任意の SNS リンク集。
--
-- 1) creator_follows: フォロワー → クリエイターの有向辺。フォロワー数を
--    プロフィールに出すため DB 化(従来の「お気に入りクリエイター」は
--    localStorage で端末ローカルだった)。
-- 2) profiles.social_links: クリエイターが任意で足せる SNS リンクの配列
--    (jsonb [{label,url}])。X / pixiv / YouTube / Misskey / Discord / BOOTH
--    など何でも。public_profiles view にも出して公開ページで表示する。
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) creator_follows(有向辺)
-- ---------------------------------------------------------------------
create table public.creator_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  creator_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),

  primary key (follower_id, creator_id),
  check (follower_id <> creator_id)
);

create index creator_follows_creator_idx on public.creator_follows (creator_id);

alter table public.creator_follows enable row level security;

-- フォロワー数の集計と「フォロー中か」の判定のため、参照は全員可。
-- (公開フォロー = Twitter 等と同じ思想。辺の内容は follower/creator のみ)
create policy "creator_follows_select_all"
  on public.creator_follows for select
  using (true);

create policy "creator_follows_insert_own"
  on public.creator_follows for insert to authenticated
  with check (follower_id = auth.uid());

create policy "creator_follows_delete_own"
  on public.creator_follows for delete to authenticated
  using (follower_id = auth.uid());

grant select on public.creator_follows to anon, authenticated;
grant insert, delete on public.creator_follows to authenticated;


-- ---------------------------------------------------------------------
-- 2) profiles.social_links(任意の SNS リンク集)
-- ---------------------------------------------------------------------
alter table public.profiles
  add column social_links jsonb not null default '[]'::jsonb;

-- public_profiles view を作り直して social_links を公開列に追加。
-- (0014 で twitter_handle / website_url を追加したのと同じ手順)
drop view if exists public.public_profiles;

create or replace view public.public_profiles
with (security_invoker = off) as
select
  id,
  display_name,
  avatar_path,
  bio,
  twitter_handle,
  website_url,
  social_links
from public.profiles;

grant select on public.public_profiles to anon, authenticated;
