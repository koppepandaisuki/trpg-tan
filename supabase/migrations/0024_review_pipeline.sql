-- =====================================================================
-- 0024_review_pipeline.sql
--
-- 審査(モデレーション)パイプライン。
--
-- これまで creator は products を自分で 'published' にできた(自己公開)。
-- ストアの「ゲームに即さない投稿」を止めるため、公開を **admin 承認制** にする:
--
--   draft ──(creator が申請)──▶ pending ──(admin 承認)──▶ published
--                                   │
--                                   └──(admin 却下: 理由付き)──▶ draft
--
--   - creator は status を draft / pending にしかできない(RLS WITH CHECK)。
--   - published / suspended への遷移は admin RPC(security definer)のみ。
--   - pending はストアに出ない(公開クエリは status='published' で絞っている)。
--
-- あわせて利用者からの「通報(product_reports)」を受け付ける。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. products.status に 'pending'(審査待ち)を追加
-- ---------------------------------------------------------------------
alter table public.products drop constraint if exists products_status_check;
alter table public.products
  add constraint products_status_check
  check (status in ('draft', 'pending', 'published', 'suspended'));

-- 却下理由 / 審査メモ(作者に表示する)。
alter table public.products add column if not exists review_note text;

-- 審査待ちを古い順に拾うための索引(admin キュー用)。
create index if not exists products_pending_idx
  on public.products (updated_at)
  where status = 'pending';

-- ---------------------------------------------------------------------
-- 2. RLS: creator は自分で公開できない(draft / pending のみ)
-- ---------------------------------------------------------------------
drop policy if exists products_update_own on public.products;
create policy products_update_own
  on public.products for update
  using (creator_id = auth.uid())
  with check (
    creator_id = auth.uid()
    and status in ('draft', 'pending')
  );

-- ---------------------------------------------------------------------
-- 3. admin_set_product_status: 'pending' も受け付けるよう更新
--    (既存ロジックは温存。pending は published_at/suspended_at を触らない)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_product_status(
  product_id  uuid,
  new_status  text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  caller_id            uuid := auth.uid();
  current_status       text;
  current_published_at timestamptz;
  next_published_at    timestamptz;
  next_suspended_at    timestamptz;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  if not exists (
    select 1 from public.profiles
     where id = caller_id and is_admin = true
  ) then
    raise exception 'forbidden';
  end if;

  if new_status not in ('draft', 'pending', 'published', 'suspended') then
    raise exception 'invalid status: %', new_status;
  end if;

  select status, published_at
    into current_status, current_published_at
    from public.products
   where id = product_id;

  if current_status is null then
    raise exception 'product not found';
  end if;

  if current_status = new_status then
    return;
  end if;

  next_published_at := current_published_at;
  if new_status = 'published' and current_published_at is null then
    next_published_at := now();
  end if;

  if new_status = 'suspended' then
    next_suspended_at := now();
  else
    next_suspended_at := null;
  end if;

  update public.products
     set status       = new_status,
         published_at = next_published_at,
         suspended_at = next_suspended_at
   where id = product_id;

  insert into public.admin_audit_logs (
    admin_id, target_type, target_id, action, payload
  )
  values (
    caller_id,
    'product',
    product_id::text,
    'set_status:' || new_status,
    jsonb_build_object(
      'before', jsonb_build_object('status', current_status),
      'after',  jsonb_build_object('status', new_status)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 4. admin_review_product(product_id, approve, note)
--    審査キュー専用。approve=true → published、false → draft + 却下理由。
-- ---------------------------------------------------------------------
create or replace function public.admin_review_product(
  product_id  uuid,
  approve     boolean,
  note        text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  caller_id            uuid := auth.uid();
  current_status       text;
  current_published_at timestamptz;
  next_status          text;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  if not exists (
    select 1 from public.profiles
     where id = caller_id and is_admin = true
  ) then
    raise exception 'forbidden';
  end if;

  select status, published_at
    into current_status, current_published_at
    from public.products
   where id = product_id;

  if current_status is null then
    raise exception 'product not found';
  end if;

  if approve then
    next_status := 'published';
    update public.products
       set status       = 'published',
           published_at  = coalesce(current_published_at, now()),
           suspended_at  = null,
           review_note   = null
     where id = product_id;
  else
    next_status := 'draft';
    update public.products
       set status      = 'draft',
           review_note = left(coalesce(note, ''), 1000)
     where id = product_id;
  end if;

  insert into public.admin_audit_logs (
    admin_id, target_type, target_id, action, payload
  )
  values (
    caller_id,
    'product',
    product_id::text,
    case when approve then 'review:approve' else 'review:reject' end,
    jsonb_build_object(
      'before', jsonb_build_object('status', current_status),
      'after',  jsonb_build_object('status', next_status),
      'note',   note
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5. product_reports: 利用者からの通報
-- ---------------------------------------------------------------------
create table if not exists public.product_reports (
  id           uuid        primary key default gen_random_uuid(),
  product_id   uuid        not null references public.products(id) on delete cascade,
  reporter_id  uuid        not null references public.profiles(id) on delete cascade,
  category     text        not null default 'other' check (
                 category in ('inappropriate', 'offtopic', 'copyright', 'illegal', 'spam', 'other')
               ),
  reason       text        not null check (char_length(reason) between 1 and 1000),
  status       text        not null default 'open' check (
                 status in ('open', 'reviewed', 'dismissed')
               ),
  created_at   timestamptz not null default now(),
  -- 同一ユーザーが同じ作品を多重通報できないようにする。
  unique (product_id, reporter_id)
);

create index if not exists product_reports_status_idx
  on public.product_reports (status, created_at desc);
create index if not exists product_reports_product_idx
  on public.product_reports (product_id);

alter table public.product_reports enable row level security;

-- 通報の作成: 本人(reporter_id = 自分)のみ。
create policy product_reports_insert_own
  on public.product_reports for insert to authenticated
  with check (reporter_id = auth.uid());

-- 自分の通報は読める。
create policy product_reports_select_own
  on public.product_reports for select to authenticated
  using (reporter_id = auth.uid());

-- admin は全件読める。
create policy product_reports_select_admin
  on public.product_reports for select to authenticated
  using (public.is_admin());

-- admin は status を更新できる(open → reviewed / dismissed)。
create policy product_reports_update_admin
  on public.product_reports for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert on public.product_reports to authenticated;
grant update on public.product_reports to authenticated; -- RLS で admin のみに限定

-- ---------------------------------------------------------------------
-- EXECUTE 権限
-- ---------------------------------------------------------------------
revoke all on function public.admin_review_product(uuid, boolean, text) from public;
grant execute on function public.admin_review_product(uuid, boolean, text) to authenticated;
