-- =====================================================================
-- 0028_friend_codes_notifications.sql
-- フレンド機能の強化:
--   1. フレンドコード(短い英数 8 桁)で互いを発見・追加。
--   2. アプリ内通知(notifications)で friend request / 承認 / 卓招待 /
--      日程調整招待を非同期にやり取り。
--   3. schedule_invites でログインユーザー宛の日程調整一覧を作る。
--
-- セキュリティ:
--   - profiles.friend_code は public な参照 RPC(`find_user_by_friend_code`)
--     を SECURITY DEFINER で公開し、profiles の RLS を緩めない。
--   - notifications は本人のみが select / update できる。INSERT は本人以外も
--     SECURITY DEFINER 関数経由で行う(他人に通知を送る必要があるため)。
--   - schedule_invites の作成は service_role(route handler)経由。
--
-- 設計メモ:
--   - friend_code は最初の発行時(ensure_my_friend_code)に一意ランダムを割り当て。
--     見やすさのため I/O/0/1 を除いた英数 8 桁(衝突確率は人数 1e6 でも極小)。
--   - 通知 payload は jsonb で柔軟に。kind ごとに想定する形は本ファイル末尾の
--     コメントに記す。
-- =====================================================================


-- ---------------------------------------------------------------------
-- profiles.friend_code
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists friend_code text;

create unique index if not exists profiles_friend_code_uidx
  on public.profiles (friend_code)
  where friend_code is not null;


-- ---------------------------------------------------------------------
-- notifications(アプリ内インボックス)
-- ---------------------------------------------------------------------
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  kind          text not null check (kind in (
                  'friend_request',
                  'friend_accepted',
                  'table_invite',
                  'schedule_invite'
                )),
  payload       jsonb not null default '{}'::jsonb,
  read_at       timestamptz,
  -- friend_request の場合: 承認 / 辞退の確定時刻。null なら未応答。
  responded_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index notifications_user_idx
  on public.notifications (user_id, created_at desc);

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;


alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notifications_delete_own"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- INSERT ポリシーは敢えて作らない: 自分宛でも他人宛でも SECURITY DEFINER
-- 関数経由でしか作れないようにする(spam 防止)。

grant select, update, delete on public.notifications to authenticated;


-- ---------------------------------------------------------------------
-- schedule_invites(自分宛の日程調整一覧用)
-- ---------------------------------------------------------------------
create table public.schedule_invites (
  schedule_event_id uuid not null references public.schedule_events(id) on delete cascade,
  invitee_id        uuid not null references public.profiles(id) on delete cascade,
  invited_by        uuid references public.profiles(id) on delete set null,
  invited_at        timestamptz not null default now(),
  primary key (schedule_event_id, invitee_id)
);

create index schedule_invites_invitee_idx
  on public.schedule_invites (invitee_id, invited_at desc);

alter table public.schedule_invites enable row level security;

create policy "schedule_invites_select_own"
  on public.schedule_invites for select to authenticated
  using (invitee_id = auth.uid());

grant select on public.schedule_invites to authenticated;
grant select, insert, delete on public.schedule_invites to service_role;


-- =====================================================================
-- 関数(SECURITY DEFINER)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 自分のフレンドコードを取得(無ければ生成)。
-- 8 文字英数(I/O/0/1 は混同回避のため除外)。衝突時は最大 8 回まで再試行。
-- ---------------------------------------------------------------------
create or replace function public.ensure_my_friend_code()
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid      uuid := auth.uid();
  v_existing text;
  v_code     text;
  v_attempt  integer := 0;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select friend_code into v_existing
    from public.profiles where id = v_uid;
  if v_existing is not null then
    return v_existing;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(
        v_alphabet,
        1 + floor(random() * length(v_alphabet))::int,
        1
      );
    end loop;

    begin
      update public.profiles
         set friend_code = v_code
       where id = v_uid;
      return v_code;
    exception when unique_violation then
      if v_attempt >= 8 then
        raise exception 'failed to generate unique friend code';
      end if;
      -- ループへ
    end;
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- フレンドコードからユーザーを検索(送信前プレビュー用)。
-- profiles の RLS を緩めずに公開できるよう definer で id / 表示名 / アバターのみ返す。
-- ---------------------------------------------------------------------
create or replace function public.find_user_by_friend_code(p_code text)
returns table (
  id           uuid,
  display_name text,
  avatar_path  text
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select p.id, p.display_name, p.avatar_path
  from public.profiles p
  where p.friend_code = upper(p_code)
  limit 1;
$$;


-- ---------------------------------------------------------------------
-- フレンド申請を送る(notifications に friend_request を作る)。
-- 既にフレンドの場合は何もせず NULL を返す。
-- ---------------------------------------------------------------------
create or replace function public.send_friend_request(p_target uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_me           uuid := auth.uid();
  v_my_name      text;
  v_my_avatar    text;
  v_notification uuid;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if v_me = p_target then raise exception 'cannot friend self'; end if;

  -- 相手の実在性チェック
  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'target not found';
  end if;

  -- 既にフレンドなら何もしない(冪等)。
  if exists (
    select 1 from public.friendships
    where (user_low = least(v_me, p_target) and user_high = greatest(v_me, p_target))
  ) then
    return null;
  end if;

  -- 直近 24h 以内に未応答の同じ依頼があれば重複しない。
  if exists (
    select 1 from public.notifications
    where user_id = p_target
      and kind = 'friend_request'
      and responded_at is null
      and (payload->>'fromUserId') = v_me::text
      and created_at > now() - interval '24 hours'
  ) then
    return null;
  end if;

  select display_name, avatar_path into v_my_name, v_my_avatar
    from public.profiles where id = v_me;

  insert into public.notifications (user_id, kind, payload)
  values (
    p_target,
    'friend_request',
    jsonb_build_object(
      'fromUserId',      v_me::text,
      'fromDisplayName', coalesce(v_my_name, ''),
      'fromAvatarPath',  v_my_avatar
    )
  )
  returning id into v_notification;

  return v_notification;
end;
$$;


-- ---------------------------------------------------------------------
-- 自分宛のフレンド申請に応答する。accept=true ならフレンドを成立させ、
-- 申請者にも friend_accepted 通知を返す。重複 / 既応答は idempotent。
-- ---------------------------------------------------------------------
create or replace function public.respond_friend_request(
  p_notification uuid,
  p_accept       boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_me        uuid := auth.uid();
  v_inviter   uuid;
  v_my_name   text;
  v_my_avatar text;
begin
  if v_me is null then raise exception 'not authenticated'; end if;

  select (payload->>'fromUserId')::uuid into v_inviter
  from public.notifications
  where id = p_notification
    and user_id = v_me
    and kind = 'friend_request'
    and responded_at is null;

  if v_inviter is null then
    return; -- 既に応答済み / 別の通知 / 存在しない → 何もしない
  end if;

  -- 通知を「応答済み」に更新。
  update public.notifications
     set responded_at = now(),
         read_at = coalesce(read_at, now()),
         payload = payload || jsonb_build_object('accepted', p_accept)
   where id = p_notification;

  if not p_accept then
    return;
  end if;

  -- フレンドを成立。
  insert into public.friendships (user_low, user_high)
  values (least(v_inviter, v_me), greatest(v_inviter, v_me))
  on conflict do nothing;

  -- 申請者にも承認の通知を送る。
  select display_name, avatar_path into v_my_name, v_my_avatar
    from public.profiles where id = v_me;

  insert into public.notifications (user_id, kind, payload)
  values (
    v_inviter,
    'friend_accepted',
    jsonb_build_object(
      'fromUserId',      v_me::text,
      'fromDisplayName', coalesce(v_my_name, ''),
      'fromAvatarPath',  v_my_avatar
    )
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 卓の参加コードをフレンドに通知。フレンド以外には送れない。
-- payload: { code, tableName, fromUserId, fromDisplayName }
-- ---------------------------------------------------------------------
create or replace function public.send_table_invite(
  p_target     uuid,
  p_code       text,
  p_table_name text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_me      uuid := auth.uid();
  v_my_name text;
  v_id      uuid;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if char_length(coalesce(p_code, '')) = 0 then
    raise exception 'code required';
  end if;

  if not exists (
    select 1 from public.friendships
    where (user_low = least(v_me, p_target) and user_high = greatest(v_me, p_target))
  ) then
    raise exception 'not friends';
  end if;

  select display_name into v_my_name from public.profiles where id = v_me;

  insert into public.notifications (user_id, kind, payload)
  values (
    p_target,
    'table_invite',
    jsonb_build_object(
      'fromUserId',      v_me::text,
      'fromDisplayName', coalesce(v_my_name, ''),
      'code',            p_code,
      'tableName',       coalesce(p_table_name, '')
    )
  )
  returning id into v_id;
  return v_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 日程調整への招待。schedule_invites に行を入れ、招待先に通知を作る。
-- payload: { fromUserId, fromDisplayName, title, publicToken, eventId }
-- 呼び出し側はサーバ(route handler / lib/mutations)で schedule_events の
-- 整合性(発行者一致 / 編集者の権限)を確認してから p_event_id を渡す前提。
-- ---------------------------------------------------------------------
create or replace function public.send_schedule_invite(
  p_event_id     uuid,
  p_target       uuid,
  p_title        text,
  p_public_token text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_me      uuid := auth.uid();
  v_my_name text;
  v_id      uuid;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from public.friendships
    where (user_low = least(v_me, p_target) and user_high = greatest(v_me, p_target))
  ) then
    raise exception 'not friends';
  end if;

  insert into public.schedule_invites (schedule_event_id, invitee_id, invited_by)
  values (p_event_id, p_target, v_me)
  on conflict do nothing;

  select display_name into v_my_name from public.profiles where id = v_me;

  insert into public.notifications (user_id, kind, payload)
  values (
    p_target,
    'schedule_invite',
    jsonb_build_object(
      'fromUserId',      v_me::text,
      'fromDisplayName', coalesce(v_my_name, ''),
      'eventId',         p_event_id::text,
      'publicToken',     p_public_token,
      'title',           coalesce(p_title, '')
    )
  )
  returning id into v_id;
  return v_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 自分宛の未読通知数。バッジ表示に使う。
-- ---------------------------------------------------------------------
create or replace function public.my_unread_count()
returns integer
language sql
security definer
set search_path = public, pg_catalog
as $$
  select count(*)::integer
  from public.notifications
  where user_id = auth.uid() and read_at is null;
$$;


-- ---------------------------------------------------------------------
-- 自分のフレンドが選択された日付について「すでに別の調整で yes/no/maybe を
-- 入れているか」を集計する。schedule_new の「空き時間レコメンド」用。
-- 引数:
--   p_friend_ids   : 対象のフレンド user_id 配列
--   p_dates        : 集計したい日付の配列(JST 24h 単位、ISO yyyy-mm-dd)
-- 戻り値:
--   date(text), yes_count, no_count, maybe_count
-- 呼び出し側はフレンドかどうかを別途確認(フレンドのみ p_friend_ids に入れる前提)。
-- ---------------------------------------------------------------------
create or replace function public.friend_date_availability(
  p_friend_ids uuid[],
  p_dates      date[]
)
returns table (
  date_iso    text,
  yes_count   integer,
  no_count    integer,
  maybe_count integer
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  with f as (
    select unnest(p_friend_ids) as user_id
    intersect
    select case when user_low = auth.uid() then user_high else user_low end
      from public.friendships
     where auth.uid() in (user_low, user_high)
  ),
  d as (
    select unnest(p_dates) as d
  ),
  votes as (
    select
      to_char(date_trunc('day', s.starts_at at time zone 'Asia/Tokyo'), 'YYYY-MM-DD') as date_iso,
      v.state,
      v.user_id
    from public.schedule_votes v
    join public.schedule_slots s on s.id = v.slot_id
    where v.user_id in (select user_id from f)
  )
  select
    to_char(d.d, 'YYYY-MM-DD') as date_iso,
    count(*) filter (where votes.state = 'yes')::integer   as yes_count,
    count(*) filter (where votes.state = 'no')::integer    as no_count,
    count(*) filter (where votes.state = 'maybe')::integer as maybe_count
  from d
  left join votes on votes.date_iso = to_char(d.d, 'YYYY-MM-DD')
  group by d.d
  order by d.d;
$$;


-- ---------------------------------------------------------------------
-- GRANT
-- ---------------------------------------------------------------------
grant execute on function public.ensure_my_friend_code()                          to authenticated;
grant execute on function public.find_user_by_friend_code(text)                   to authenticated;
grant execute on function public.send_friend_request(uuid)                        to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean)            to authenticated;
grant execute on function public.send_table_invite(uuid, text, text)              to authenticated;
grant execute on function public.send_schedule_invite(uuid, uuid, text, text)     to authenticated;
grant execute on function public.my_unread_count()                                to authenticated;
grant execute on function public.friend_date_availability(uuid[], date[])         to authenticated;


-- =====================================================================
-- payload 例:
--   friend_request:
--     { "fromUserId": "...", "fromDisplayName": "...", "fromAvatarPath": "..." }
--   friend_accepted:
--     { "fromUserId": "...", "fromDisplayName": "...", "fromAvatarPath": "..." }
--   table_invite:
--     { "fromUserId": "...", "fromDisplayName": "...",
--       "code": "ABCD-1234", "tableName": "クトゥルフ卓" }
--   schedule_invite:
--     { "fromUserId": "...", "fromDisplayName": "...",
--       "eventId": "...", "publicToken": "...", "title": "Session 3" }
-- =====================================================================
