-- 0038_gold_economy.sql
--
-- ゴールド経済圏: 台帳(gold_transactions) + 原子的 RPC。
--   - AI 従量課金(spend_gold): PLAY の AI を運営 API キーで提供し、1回ごとに消費
--   - 作品のゴールド購入(purchase_with_gold): 実効価格(割引込み)ぶん消費して purchases に記録
--   - スーパーサンクス(transfer_gold): クリエイターへゴールドを贈る
--   - Stripe パック購入の加算(credit_gold): webhook から冪等に付与
--
-- ポリシー: ゴールドは現金化できない(払い出し経路を作らない)。
-- RLS: 台帳は本人の SELECT のみ。書き込みはすべて RPC(security definer) /
--      service_role 経由。profiles.gold_balance の直接 UPDATE 権限は与えない。

create table if not exists public.gold_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- 正 = 付与 / 負 = 消費。残高の整合は RPC 内で担保する。
  amount     integer not null check (amount <> 0),
  kind       text not null check (kind in
               ('redeem', 'stripe_pack', 'ai_usage', 'purchase',
                'tip_sent', 'tip_received', 'admin', 'refund')),
  -- 参照 id(商品 id / Stripe session id / チップ相手 など)。
  ref_id     text,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.gold_transactions enable row level security;

create policy "own gold transactions"
  on public.gold_transactions for select
  using (auth.uid() = user_id);

create index if not exists gold_tx_user_idx
  on public.gold_transactions (user_id, created_at desc);

-- Stripe パックの二重付与防止(同一 session の再配信を無効化)。
create unique index if not exists gold_tx_stripe_ref_uidx
  on public.gold_transactions (ref_id) where kind = 'stripe_pack';

-- ---------------------------------------------------------------------
-- spend_gold: 呼び出しユーザー本人の残高から p_amount を消費(不足なら例外)。
-- 戻り値: 消費後残高。
-- ---------------------------------------------------------------------
create or replace function public.spend_gold(
  p_amount integer,
  p_kind   text,
  p_ref    text default null,
  p_note   text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_balance integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;
  update public.profiles
     set gold_balance = gold_balance - p_amount
   where id = v_uid and gold_balance >= p_amount
   returning gold_balance into v_balance;
  if not found then
    raise exception 'insufficient_gold';
  end if;
  insert into public.gold_transactions (user_id, amount, kind, ref_id, note)
  values (v_uid, -p_amount, p_kind, p_ref, p_note);
  return v_balance;
end;
$$;
revoke all on function public.spend_gold(integer, text, text, text) from public;
grant execute on function public.spend_gold(integer, text, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- credit_gold: 付与(webhook / 返金 / 運営)。service_role 専用。
-- kind='stripe_pack' は ref の一意制約で冪等(重複時 false)。
-- ---------------------------------------------------------------------
create or replace function public.credit_gold(
  p_user   uuid,
  p_amount integer,
  p_kind   text,
  p_ref    text default null,
  p_note   text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;
  begin
    insert into public.gold_transactions (user_id, amount, kind, ref_id, note)
    values (p_user, p_amount, p_kind, p_ref, p_note);
  exception when unique_violation then
    return false; -- 同一 Stripe session の再配信 → 付与済み
  end;
  update public.profiles
     set gold_balance = gold_balance + p_amount
   where id = p_user;
  if not found then
    raise exception 'profile_not_found';
  end if;
  return true;
end;
$$;
revoke all on function public.credit_gold(uuid, integer, text, text, text) from public;
grant execute on function public.credit_gold(uuid, integer, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------
-- transfer_gold: スーパーサンクス。本人 → クリエイターへ移転(原子的)。
-- 戻り値: 送り主の消費後残高。
-- ---------------------------------------------------------------------
create or replace function public.transfer_gold(
  p_to     uuid,
  p_amount integer,
  p_ref    text default null,   -- 商品 id など(任意)
  p_note   text default null    -- 応援メッセージ(任意・短文)
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_balance integer;
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
  return v_balance;
end;
$$;
revoke all on function public.transfer_gold(uuid, integer, text, text) from public;
grant execute on function public.transfer_gold(uuid, integer, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- purchase_with_gold: 作品をゴールドで購入。実効価格(期間つき割引込み)を
-- SQL 側で再計算して残高から消費し、purchases に記録する(原子的)。
--   - 無料(実効 0 円)は対象外(既存の無料入手フローを使う)
--   - 二重購入は既購入チェックで弾く
--   - stripe_session_id には 'gold_<uuid>' を入れる(NOT NULL UNIQUE のため)
-- 戻り値: 消費後残高。
-- ---------------------------------------------------------------------
create or replace function public.purchase_with_gold(
  p_product uuid
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prod record;
  v_pct integer;
  v_price integer;
  v_balance integer;
  v_creator_plan text;
  v_fee_pct integer;
  v_creator_gold integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select id, creator_id, price_jpy, discount_percent,
         discount_starts_at, discount_ends_at, status
    into v_prod
    from public.products
   where id = p_product;
  if not found or v_prod.status <> 'published' then
    raise exception 'product_not_found';
  end if;
  if v_prod.creator_id = v_uid then
    raise exception 'own_product';
  end if;

  -- 実効割引(期間内のみ有効) → 実効価格(web の salePriceJpy と同一の丸め)。
  v_pct := coalesce(v_prod.discount_percent, 0);
  if v_pct > 0 then
    if (v_prod.discount_starts_at is not null and v_prod.discount_starts_at > now())
       or (v_prod.discount_ends_at is not null and v_prod.discount_ends_at < now()) then
      v_pct := 0;
    end if;
  end if;
  v_price := floor(v_prod.price_jpy * (100 - v_pct) / 100.0)::integer;
  if v_price <= 0 then
    raise exception 'free_product';
  end if;

  if exists (
    select 1 from public.purchases
     where user_id = v_uid and product_id = p_product and status = 'paid'
  ) then
    raise exception 'already_purchased';
  end if;

  update public.profiles
     set gold_balance = gold_balance - v_price
   where id = v_uid and gold_balance >= v_price
   returning gold_balance into v_balance;
  if not found then
    raise exception 'insufficient_gold';
  end if;

  -- クリエイターへは手数料(基本30% / Pro20%)を差し引いたゴールドを付与する。
  -- 現金は動かない(ゴールドは現金化不可)が、売上としては通常購入と同じ扱い。
  select plan into v_creator_plan
    from public.profiles where id = v_prod.creator_id;
  v_fee_pct := case when v_creator_plan = 'pro' then 20 else 30 end;
  v_creator_gold := floor(v_price * (100 - v_fee_pct) / 100.0)::integer;

  insert into public.purchases
    (user_id, product_id, stripe_session_id, amount_jpy, currency,
     status, paid_at, creator_id, application_fee_jpy)
  values
    (v_uid, p_product, 'gold_' || gen_random_uuid(), v_price, 'gold',
     'paid', now(), v_prod.creator_id, v_price - v_creator_gold);

  insert into public.gold_transactions (user_id, amount, kind, ref_id)
  values (v_uid, -v_price, 'purchase', p_product::text);

  if v_creator_gold > 0 and v_prod.creator_id is not null then
    update public.profiles
       set gold_balance = gold_balance + v_creator_gold
     where id = v_prod.creator_id;
    insert into public.gold_transactions (user_id, amount, kind, ref_id, note)
    values (v_prod.creator_id, v_creator_gold, 'purchase', p_product::text,
            'ゴールド売上(手数料差引後)');
  end if;

  return v_balance;
end;
$$;
revoke all on function public.purchase_with_gold(uuid) from public;
grant execute on function public.purchase_with_gold(uuid)
  to authenticated, service_role;
