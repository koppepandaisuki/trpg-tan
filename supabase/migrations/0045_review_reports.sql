-- =====================================================================
-- 0045_review_reports.sql
-- レビュー本文の通報(モデレーション)。product_reports(0024)のレビュー版。
--
-- 方針(2026-07-05, ユーザー選択「通報+admin手動レビュー」):
--   - 利用者がレビューを通報 → review_reports に記録。自動非表示はしない。
--   - admin が /admin/reports の「レビュー通報」で内容を確認し、削除 or 却下。
--   - 削除は admin_delete_review RPC(監査ログ付き)。cascade で当該 review の
--     review_reports / review_replies / review_votes も消える。
-- =====================================================================

create table if not exists public.review_reports (
  id          uuid        primary key default gen_random_uuid(),
  review_id   uuid        not null references public.product_reviews(id) on delete cascade,
  reporter_id uuid        not null references public.profiles(id) on delete cascade,
  category    text        not null default 'other' check (
                category in ('inappropriate', 'offtopic', 'copyright', 'illegal', 'spam', 'other')
              ),
  reason      text        not null check (char_length(reason) between 1 and 1000),
  status      text        not null default 'open' check (
                status in ('open', 'reviewed', 'dismissed')
              ),
  created_at  timestamptz not null default now(),
  -- 同一ユーザーが同じレビューを多重通報できない。
  unique (review_id, reporter_id)
);

create index if not exists review_reports_status_idx
  on public.review_reports (status, created_at desc);
create index if not exists review_reports_review_idx
  on public.review_reports (review_id);

alter table public.review_reports enable row level security;

-- 通報の作成: 本人(reporter_id = 自分)のみ。
create policy review_reports_insert_own
  on public.review_reports for insert to authenticated
  with check (reporter_id = auth.uid());

-- 自分の通報は読める。
create policy review_reports_select_own
  on public.review_reports for select to authenticated
  using (reporter_id = auth.uid());

-- admin は全件読める。
create policy review_reports_select_admin
  on public.review_reports for select to authenticated
  using (public.is_admin());

-- admin は status を更新できる(open → reviewed / dismissed)。
create policy review_reports_update_admin
  on public.review_reports for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert on public.review_reports to authenticated;
grant update on public.review_reports to authenticated; -- RLS で admin のみに限定

-- ---------------------------------------------------------------------
-- admin_delete_review(target_review_id)
--   通報されたレビューを削除(監査ログ付き)。0003 の admin RPC と同じ設計。
--   product_reviews_delete_own(0016)は本人のみなので、他人のレビューを
--   admin が消すにはこの security definer RPC が要る。
-- ---------------------------------------------------------------------
create or replace function public.admin_delete_review(target_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  caller_id  uuid := auth.uid();
  v_product  uuid;
  v_author   uuid;
  v_comment  text;
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

  select product_id, user_id, comment
    into v_product, v_author, v_comment
    from public.product_reviews
   where id = target_review_id;

  if v_product is null then
    raise exception 'target not found';
  end if;

  delete from public.product_reviews where id = target_review_id;

  insert into public.admin_audit_logs (
    admin_id, target_type, target_id, action, payload
  )
  values (
    caller_id,
    'review',
    target_review_id::text,
    'delete_review',
    jsonb_build_object(
      'product_id', v_product,
      'author_id',  v_author,
      'comment',    v_comment
    )
  );
end;
$$;

revoke all on function public.admin_delete_review(uuid) from public;
grant execute on function public.admin_delete_review(uuid) to authenticated;
