-- 0040_notify_tip_review.sql
--
-- 通知センター(既存 notifications インボックス)を拡張:
--   - tip_received  … スーパーサンクスを受け取った(transfer_gold から発火)
--   - product_review… 自分の作品にレビューが付いた(product_reviews トリガー)
--
-- どちらも既存の未読バッジ / 既読管理(0028)に相乗りする。

-- kind の CHECK 制約に 3 種を追加(既存値は維持)。
--   tip_received    … スーパーサンクス受領(transfer_gold から発火)
--   product_review  … 自分の作品への新規レビュー(trigger)
--   review_decision … 出品審査の承認/却下/公開停止(app 側の通知処理から insert)
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in (
    'friend_request',
    'friend_accepted',
    'table_invite',
    'schedule_invite',
    'tip_received',
    'product_review',
    'review_decision'
  ));

-- ---------------------------------------------------------------------
-- transfer_gold: スーパーサンクスの移転に「受領通知」を足す(0038 を置換)。
-- 変更点は最後の notification insert のみ。移転ロジックは同一。
-- ---------------------------------------------------------------------
create or replace function public.transfer_gold(
  p_to     uuid,
  p_amount integer,
  p_ref    text default null,
  p_note   text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_balance integer;
  v_my_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_to is null or p_to = v_uid then
    raise exception 'invalid_recipient';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000 then
    raise exception 'invalid_amount';
  end if;
  update public.profiles
     set gold_balance = gold_balance - p_amount
   where id = v_uid and gold_balance >= p_amount
   returning gold_balance into v_balance;
  if not found then
    raise exception 'insufficient_gold';
  end if;
  update public.profiles
     set gold_balance = gold_balance + p_amount
   where id = p_to;
  if not found then
    raise exception 'recipient_not_found';
  end if;
  insert into public.gold_transactions (user_id, amount, kind, ref_id, note)
  values (v_uid, -p_amount, 'tip_sent', coalesce(p_ref, p_to::text), p_note),
         (p_to,  p_amount, 'tip_received', coalesce(p_ref, v_uid::text), p_note);

  -- 受領者へアプリ内通知。
  select display_name into v_my_name from public.profiles where id = v_uid;
  insert into public.notifications (user_id, kind, payload)
  values (
    p_to,
    'tip_received',
    jsonb_build_object(
      'fromUserId',      v_uid::text,
      'fromDisplayName', coalesce(v_my_name, ''),
      'amount',          p_amount,
      'message',         coalesce(p_note, ''),
      'productId',       p_ref
    )
  );

  return v_balance;
end;
$$;
revoke all on function public.transfer_gold(uuid, integer, text, text) from public;
grant execute on function public.transfer_gold(uuid, integer, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- product_reviews への新規レビューで、作品のクリエイターへ通知する trigger。
-- SECURITY DEFINER(notifications は INSERT ポリシーを持たないため definer 経由)。
-- 自分の作品への自己レビューは通知しない。
-- AFTER INSERT のみ: web/desktop とも upsert(ON CONFLICT DO UPDATE)で投稿する
-- ため、編集(2 回目以降の保存)では発火せず初回投稿時にだけ通知される。
-- ---------------------------------------------------------------------
create or replace function public.notify_product_review()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_creator uuid;
  v_title   text;
  v_name    text;
begin
  select creator_id, title into v_creator, v_title
    from public.products where id = new.product_id;
  if v_creator is null or v_creator = new.user_id then
    return new;
  end if;
  select display_name into v_name
    from public.profiles where id = new.user_id;
  insert into public.notifications (user_id, kind, payload)
  values (
    v_creator,
    'product_review',
    jsonb_build_object(
      'fromUserId',      new.user_id::text,
      'fromDisplayName', coalesce(v_name, ''),
      'productId',       new.product_id::text,
      'productTitle',    coalesce(v_title, ''),
      'stars',           new.stars,
      'comment',         left(coalesce(new.comment, ''), 140)
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_product_review on public.product_reviews;
create trigger trg_notify_product_review
  after insert on public.product_reviews
  for each row execute function public.notify_product_review();
