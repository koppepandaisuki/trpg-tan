-- =====================================================================
-- 0020_friends.sql
-- フレンド機能(招待リンク方式 + 最終アクティブ方式の在席表示)。
--
-- 設計:
--   - フレンドは「無向の辺」。friendships に (user_low, user_high) で 1 行。
--     low < high を強制して重複(A-B と B-A)を防ぐ。
--   - 追加は「招待リンク」経由。各ユーザーが自分の招待トークンを発行し、
--     共有された相手がログイン状態で開いて承認すると friendship が成立する。
--     → ユーザー名検索や承認待ち行列は持たない(最小・手軽)。
--   - 在席表示は profiles.last_seen_at を心拍(touch_presence)で更新し、
--     「数分以内ならオンライン」とクライアントで判定する。リアルタイム購読は使わない。
--   - 他者プロフィールの参照(フレンド一覧/招待プレビュー)と friendship の
--     作成は SECURITY DEFINER 関数で安全に閉じる(profiles の RLS を緩めない)。
-- =====================================================================


-- ---------------------------------------------------------------------
-- 在席(最終アクティブ時刻)
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists last_seen_at timestamptz;


-- ---------------------------------------------------------------------
-- テーブル: friendships(無向の辺)
-- ---------------------------------------------------------------------
create table public.friendships (
  user_low   uuid not null references public.profiles(id) on delete cascade,
  user_high  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (user_low, user_high),
  check (user_low < user_high)
);

create index friendships_high_idx on public.friendships (user_high);


-- ---------------------------------------------------------------------
-- テーブル: friend_invites(招待トークン)
-- ---------------------------------------------------------------------
create table public.friend_invites (
  token      uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  revoked    boolean not null default false,
  created_at timestamptz not null default now()
);

create index friend_invites_inviter_idx on public.friend_invites (inviter_id);


-- ---------------------------------------------------------------------
-- RLS: friendships
--   - 参照/削除は当事者のみ。作成は accept_friend_invite()(definer)のみ。
-- ---------------------------------------------------------------------
alter table public.friendships enable row level security;

create policy "friendships_select_own"
  on public.friendships for select to authenticated
  using (user_low = auth.uid() or user_high = auth.uid());

create policy "friendships_delete_own"
  on public.friendships for delete to authenticated
  using (user_low = auth.uid() or user_high = auth.uid());
-- INSERT ポリシーは作らない(クライアント直挿入を拒否。作成は definer 関数経由)。


-- ---------------------------------------------------------------------
-- RLS: friend_invites
--   - 自分のトークンのみ参照/発行/失効。招待された側は definer 関数で読む。
-- ---------------------------------------------------------------------
alter table public.friend_invites enable row level security;

create policy "friend_invites_select_own"
  on public.friend_invites for select to authenticated
  using (inviter_id = auth.uid());

create policy "friend_invites_insert_own"
  on public.friend_invites for insert to authenticated
  with check (inviter_id = auth.uid());

create policy "friend_invites_update_own"
  on public.friend_invites for update to authenticated
  using (inviter_id = auth.uid())
  with check (inviter_id = auth.uid());


-- ---------------------------------------------------------------------
-- 関数(SECURITY DEFINER)
-- ---------------------------------------------------------------------

-- 在席の心拍。自分の last_seen_at を now() に更新するだけ。
create or replace function public.touch_presence()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

-- 自分のフレンド一覧(相手のプロフィール + 在席)。profiles RLS を緩めずに公開。
create or replace function public.list_friends()
returns table (
  id           uuid,
  display_name text,
  avatar_path  text,
  last_seen_at timestamptz,
  since        timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    p.avatar_path,
    p.last_seen_at,
    f.created_at as since
  from public.friendships f
  join public.profiles p
    on p.id = case when f.user_low = auth.uid() then f.user_high else f.user_low end
  where auth.uid() in (f.user_low, f.user_high)
  order by p.last_seen_at desc nulls last;
$$;

-- 招待トークンの招待主プレビュー(ログイン前でも表示するため anon にも公開)。
create or replace function public.friend_invite_info(p_token uuid)
returns table (
  inviter_id   uuid,
  display_name text,
  avatar_path  text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_path
  from public.friend_invites fi
  join public.profiles p on p.id = fi.inviter_id
  where fi.token = p_token and fi.revoked = false;
$$;

-- 招待トークンを承認してフレンド成立。招待主 id を返す(無効なら null)。
create or replace function public.accept_friend_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me      uuid := auth.uid();
  v_inviter uuid;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  select inviter_id into v_inviter
  from public.friend_invites
  where token = p_token and revoked = false;

  if v_inviter is null then
    return null; -- 無効 / 失効済み
  end if;

  if v_inviter = v_me then
    return v_inviter; -- 自分のリンク。フレンドにはしない(冪等に成功扱い)。
  end if;

  insert into public.friendships (user_low, user_high)
  values (least(v_inviter, v_me), greatest(v_inviter, v_me))
  on conflict do nothing;

  return v_inviter;
end;
$$;


-- ---------------------------------------------------------------------
-- GRANT
-- ---------------------------------------------------------------------
grant select, delete on public.friendships to authenticated;
grant select, insert, update on public.friend_invites to authenticated;

grant execute on function public.touch_presence()              to authenticated;
grant execute on function public.list_friends()                to authenticated;
grant execute on function public.accept_friend_invite(uuid)    to authenticated;
grant execute on function public.friend_invite_info(uuid)      to anon, authenticated;
