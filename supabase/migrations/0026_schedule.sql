-- =====================================================================
-- 0026_schedule.sql
-- 日程調整ツール(調整さん型のセッション日程投票)。
--
-- 設計(grill-me 2026-06-21 合意):
--   - 主催はアプリ/web どちらからでも作成。参加者は web URL で投票(ログイン任意)。
--   - 公開トークン(public_token) = 閲覧・投票・コメント。
--     管理トークン(admin_token) = 候補編集・確定・削除(主催だけが持つ)。
--   - 編集は信頼ベース(URL を知る仲間内なら誰でも直せる)。ログイン者は
--     user_id を裏で記録し「自分のイベント一覧」に出す。
--   - list(離散候補) / grid(自動生成した密な候補) はどちらも slots+votes の
--     同一スキーマに落とす。mode は描画の違いだけ。
--
-- セキュリティ:
--   匿名アクセスをこのコードベースで初めて扱う。RLS は全面ロック(ポリシー無し)、
--   anon/authenticated には GRANT しない。トークン(特に admin_token)は
--   ブラウザに直接渡してはならないため、全アクセスをサーバ(route handler)経由の
--   service_role に限定する。サーバがトークンを検証して操作する。
-- =====================================================================


-- ---------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------
create table public.schedule_events (
  id            uuid primary key default gen_random_uuid(),
  public_token  text not null unique,
  admin_token   text not null unique,
  title         text not null check (char_length(title) between 1 and 200),
  memo          text not null default '' check (char_length(memo) <= 4000),
  mode          text not null default 'list' check (mode in ('list', 'grid')),
  deadline      timestamptz,
  -- 任意のシナリオ参照({kind:'product'|'free', productId?, slug?, title, coverPath?})。
  scenario_ref  jsonb,
  -- ログイン主催のみ記録(「自分のイベント」用)。退会時は null 化して残す。
  owner_user_id uuid references public.profiles(id) on delete set null,
  -- 確定した枠(主催が選ぶ)。slots 作成後に FK を張る。
  finalized_slot_id uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index schedule_events_owner_idx
  on public.schedule_events (owner_user_id, created_at desc);

create trigger schedule_events_set_updated_at
  before update on public.schedule_events
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- slots(候補。list も grid も同一表)
-- ---------------------------------------------------------------------
create table public.schedule_slots (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.schedule_events(id) on delete cascade,
  starts_at  timestamptz not null,
  label      text not null default '' check (char_length(label) <= 100),
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

create index schedule_slots_event_idx
  on public.schedule_slots (event_id, starts_at);

-- events.finalized_slot_id の FK(slots 作成後に付与)。
alter table public.schedule_events
  add constraint schedule_events_finalized_slot_fk
  foreign key (finalized_slot_id)
  references public.schedule_slots(id) on delete set null;


-- ---------------------------------------------------------------------
-- votes(1 人 = voter_key。slot ごとに 1 行)
-- ---------------------------------------------------------------------
create table public.schedule_votes (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.schedule_events(id) on delete cascade,
  slot_id    uuid not null references public.schedule_slots(id) on delete cascade,
  -- 表示名(自己申告)。同一 voter_key の最新行の名前を採用して表示する。
  voter_name text not null check (char_length(voter_name) between 1 and 60),
  -- 1 人を束ねる安定キー(ブラウザ保存 or ログイン user_id)。自分の行の再編集に使う。
  voter_key  text not null check (char_length(voter_key) between 1 and 80),
  state      text not null check (state in ('yes', 'maybe', 'no')),
  user_id    uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 同じ枠 × 同じ人 = 1 行(upsert 用)。
  unique (slot_id, voter_key)
);

create index schedule_votes_event_idx on public.schedule_votes (event_id);
create index schedule_votes_slot_idx  on public.schedule_votes (slot_id);

create trigger schedule_votes_set_updated_at
  before update on public.schedule_votes
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------
create table public.schedule_comments (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.schedule_events(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  text       text not null check (char_length(text) between 1 and 2000),
  user_id    uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index schedule_comments_event_idx
  on public.schedule_comments (event_id, created_at);


-- ---------------------------------------------------------------------
-- RLS: 全面ロック(ポリシー無し = anon/authenticated は直アクセス不可)。
-- 全操作はサーバ(route handler)経由の service_role で行い、トークンを
-- サーバ側で検証する。admin_token をブラウザの直接クエリに晒さないため。
-- ---------------------------------------------------------------------
alter table public.schedule_events   enable row level security;
alter table public.schedule_slots    enable row level security;
alter table public.schedule_votes    enable row level security;
alter table public.schedule_comments enable row level security;


-- ---------------------------------------------------------------------
-- GRANT: service_role のみ。anon/authenticated には付与しない。
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.schedule_events   to service_role;
grant select, insert, update, delete on public.schedule_slots    to service_role;
grant select, insert, update, delete on public.schedule_votes    to service_role;
grant select, insert, update, delete on public.schedule_comments to service_role;
