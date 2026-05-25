-- =====================================================================
-- 0001_initial_schema.sql
-- TRPG プラットフォーム MVP — 初期スキーマ
--
-- 適用順:
--   0001_initial_schema.sql  -- このファイル(テーブル・関数・トリガー・ビュー)
--   0002_rls_policies.sql    -- 次のファイル(RLS有効化 + ポリシー)
--   seed.sql                 -- 開発時のみ(ダミーデータ)
--
-- 設計方針:
--   - product_type / file_format / status は text + CHECK 制約
--   - purchases.user_id は nullable(退会後の売上記録を保全)
--   - 削除挙動: 購入履歴のある products は DB レベルで物理削除不可
--   - RLS は次の migration で「明示的に許可するもののみ」を定義する
-- =====================================================================


-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;


-- ---------------------------------------------------------------------
-- Helper: set_updated_at
-- 任意のテーブルの UPDATE 時に updated_at を now() に書き換えるトリガー関数。
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- profiles
--   auth.users と 1:1 で紐づくアプリ側のユーザー情報。
--   is_admin / is_creator はクライアントからは更新不可(RLS で担保)。
-- ---------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text        not null default '' check (char_length(display_name) <= 50),
  bio           text        not null default '' check (char_length(bio) <= 500),
  avatar_path   text,
  is_creator    boolean     not null default false,
  is_admin      boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- Helper: handle_new_user
--   auth.users の INSERT 時に、対応する public.profiles 行を自動生成する。
--   SECURITY DEFINER。auth スキーマへの参照のため public 以外を search_path から外す。
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- Role check helpers
--   profiles の RLS の中で profiles を参照すると無限再帰する。これを避けるため、
--   is_admin() / is_creator() を SECURITY DEFINER 関数として定義し、ポリシーは
--   関数経由で判定する。
--   関数自体は boolean を返すだけなので、情報漏えいリスクは限定的。
-- ---------------------------------------------------------------------
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = uid and is_admin = true
  );
$$;

create or replace function public.is_creator(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = uid and is_creator = true
  );
$$;


-- ---------------------------------------------------------------------
-- products
--   販売対象。status('draft'/'published'/'suspended')で公開を制御。
--   product_type / file_format は MVP で扱う 5種類 / 3種類。
--   ファイル実体は Storage に置き、ここではキーのみを保持する。
-- ---------------------------------------------------------------------
create table public.products (
  id                    uuid        primary key default gen_random_uuid(),
  creator_id            uuid        not null references public.profiles(id) on delete restrict,
  slug                  text        not null unique check (char_length(slug) between 1 and 80),
  title                 text        not null check (char_length(title) between 1 and 100),
  description           text        not null default '' check (char_length(description) <= 10000),

  product_type          text        not null check (
                          product_type in ('scenario', 'rulebook', 'character_art', 'map', 'bgm_audio')
                        ),
  file_format           text        not null check (
                          file_format in ('pdf', 'image_zip', 'audio')
                        ),
  price_jpy             integer     not null check (price_jpy between 0 and 10000000),
  status                text        not null default 'draft' check (
                          status in ('draft', 'published', 'suspended')
                        ),

  -- Storage キー(本体ファイルはここではなく Storage に存在する)
  cover_path            text,
  file_path             text,

  -- 詳細メタ(画像3の作品詳細パネルに対応)
  system_label          text        check (char_length(system_label) <= 100),
  players               text        check (char_length(players) <= 50),
  playtime              text        check (char_length(playtime) <= 50),
  recommended_skills    text        check (char_length(recommended_skills) <= 200),
  allow_commercial      boolean     not null default false,
  allow_redistribution  boolean     not null default false,

  -- ライフサイクル
  published_at          timestamptz,
  suspended_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- status と日時の整合
  constraint products_published_at_required
    check (status <> 'published' or published_at is not null),
  constraint products_suspended_at_required
    check (status <> 'suspended' or suspended_at is not null)
);

create index products_status_published_at_idx
  on public.products (status, published_at desc);
create index products_creator_id_idx
  on public.products (creator_id);
create index products_product_type_idx
  on public.products (product_type);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- product_tags
--   products と「文字列タグ」の中間表。tags マスタは MVP では作らない。
--   入力時は trim + lower で正規化する前提。CHECK で lower を強制。
-- ---------------------------------------------------------------------
create table public.product_tags (
  product_id  uuid not null references public.products(id) on delete cascade,
  tag         text not null check (
                char_length(tag) between 1 and 30
                and tag = lower(tag)
              ),
  primary key (product_id, tag)
);

create index product_tags_tag_idx on public.product_tags (tag);


-- ---------------------------------------------------------------------
-- purchases
--   1作品=1購入の購入記録。Stripe Checkout Session ID で冪等性を担保。
--   user_id は nullable(profiles 削除時は SET NULL = 売上記録の保全)。
--   product_id は restrict(購入履歴がある作品は DB レベルで削除不可)。
--   書き込みは Webhook(service_role)のみで行う運用(RLS で担保)。
-- ---------------------------------------------------------------------
create table public.purchases (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        references public.profiles(id) on delete set null,
  product_id          uuid        not null references public.products(id) on delete restrict,
  stripe_session_id   text        not null unique,
  amount_jpy          integer     not null check (amount_jpy >= 0),
  currency            text        not null default 'jpy',
  status              text        not null default 'paid' check (
                        status in ('pending', 'paid', 'refunded')
                      ),
  paid_at             timestamptz,
  refunded_at         timestamptz,
  created_at          timestamptz not null default now(),

  constraint purchases_paid_at_required
    check (status <> 'paid' or paid_at is not null),
  constraint purchases_refunded_at_required
    check (status <> 'refunded' or refunded_at is not null)
);

create index purchases_user_id_status_idx
  on public.purchases (user_id, status);
create index purchases_product_id_status_idx
  on public.purchases (product_id, status);


-- ---------------------------------------------------------------------
-- creator_applications
--   申請制 creator 導線の将来用テーブル。MVP では UI を作らない(RLSのみ完成)。
--   「pending は同一ユーザー1件のみ」を部分 UNIQUE で担保する。
-- ---------------------------------------------------------------------
create table public.creator_applications (
  id            uuid        primary key default gen_random_uuid(),
  applicant_id  uuid        not null references public.profiles(id) on delete cascade,
  reason        text        not null default '' check (char_length(reason) <= 1000),
  status        text        not null default 'pending' check (
                  status in ('pending', 'approved', 'rejected')
                ),
  reviewed_by   uuid        references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  note          text        check (char_length(note) <= 1000),
  created_at    timestamptz not null default now()
);

create unique index creator_applications_one_pending_per_user
  on public.creator_applications (applicant_id)
  where status = 'pending';


-- ---------------------------------------------------------------------
-- admin_audit_logs
--   admin の操作記録(creator付与/剥奪、作品suspend など)。
--   書き込みはサーバー(service_role)のみ。読みは admin のみ(RLSで担保)。
-- ---------------------------------------------------------------------
create table public.admin_audit_logs (
  id           uuid        primary key default gen_random_uuid(),
  admin_id     uuid        references public.profiles(id) on delete set null,
  target_type  text        not null,         -- 'profile' | 'product' | 'purchase' など
  target_id    text        not null,         -- UUID 以外も入る可能性があるため text
  action       text        not null,         -- 'grant_creator' | 'suspend_product' など
  payload      jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);
create index admin_audit_logs_target_idx
  on public.admin_audit_logs (target_type, target_id);


-- ---------------------------------------------------------------------
-- public_profiles ビュー
--   作者カード等で誰でも参照してよい最小項目だけを露出する。
--   含める列: id / display_name / avatar_path / bio のみ
--   含めない: is_creator / is_admin / email
--
--   security_invoker = off によりビュー所有者の権限で profiles を読む。
--   ビュー越しの参照は profiles の RLS を回避するが、ビュー定義の列以外は
--   外部に出ない。GRANT は rls.sql で行う。
-- ---------------------------------------------------------------------
create or replace view public.public_profiles
with (security_invoker = off) as
select
  id,
  display_name,
  avatar_path,
  bio
from public.profiles;
