-- =====================================================================
-- 0051: 無料プランのフレンド数の上限
-- ---------------------------------------------------------------------
-- フレンド数の上限(数値はここ 1 か所だけ。変えるときは friend_limit() を直す):
--   admin / play / pro : 無制限
--   それ以外(basic)    : 30 人
--
-- - 上限は「新しくフレンドになる」ときだけ見る。すでに上限を超えている人の
--   フレンドは消さない(上限を入れる前からの関係はそのまま)。
-- - フレンドは両側に数えるので、申請した側・受けた側のどちらかが上限なら成立しない。
--   エラーの detail に「自分(mine)/ 相手(theirs)」を入れて、画面で言い分ける。
-- - 既にフレンドの 2 人(on conflict do nothing で何もしない場合)は止めない。
-- - 0050(キャラシの保存数)と同じく、他人のプランを探れないよう friend_limit() に
--   直接の実行権は与えない(下の定義者関数から使う)。
-- =====================================================================

create or replace function public.friend_limit(p_uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.profiles p
      where p.id = p_uid and (p.is_admin or p.plan in ('play', 'pro'))
    ) then null
    else 30
  end;
$$;
revoke all on function public.friend_limit(uuid) from public;

create or replace function public.friend_count(p_uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.friendships
  where user_low = p_uid or user_high = p_uid;
$$;
revoke all on function public.friend_count(uuid) from public;

create or replace function public.enforce_friend_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_who  uuid;
  v_lim  integer;
begin
  -- すでにフレンドなら何もしない(insert ... on conflict do nothing の再承認)。
  if exists (
    select 1 from public.friendships
    where user_low = new.user_low and user_high = new.user_high
  ) then
    return new;
  end if;

  -- 2 人それぞれの同時成立を直列化(順番を固定してデッドロックを避ける)。
  perform pg_advisory_xact_lock(hashtext('friendships:' || new.user_low::text));
  perform pg_advisory_xact_lock(hashtext('friendships:' || new.user_high::text));

  foreach v_who in array array[new.user_low, new.user_high] loop
    v_lim := public.friend_limit(v_who);
    if v_lim is not null and public.friend_count(v_who) >= v_lim then
      raise exception 'friend_limit_reached'
        using errcode = 'P0001',
              detail = case when v_who = auth.uid() then 'mine' else 'theirs' end,
              hint = format('limit=%s', v_lim);
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.enforce_friend_limit() from public;

drop trigger if exists friendships_enforce_limit on public.friendships;
create trigger friendships_enforce_limit
  before insert on public.friendships
  for each row execute function public.enforce_friend_limit();

-- 画面表示用: 自分のフレンド数と上限(上限 null = 無制限)。
create or replace function public.my_friend_quota()
returns table (used integer, friend_limit integer)
language sql
stable
security definer
set search_path = public
as $$
  select public.friend_count(auth.uid()), public.friend_limit(auth.uid());
$$;
revoke all on function public.my_friend_quota() from public;
grant execute on function public.my_friend_quota() to authenticated;
