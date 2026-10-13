-- =====================================================================
-- 0050_character_sheets.sql
-- Web 版キャラシのクラウド保存 + プラン別の保存数上限。
--
-- 背景:
--   キャラシのエディタはデスクトップと Web で共通(@trpg/ui)。デスクトップは
--   ローカルの .ccsheet ファイルに保存するが、ブラウザにはファイルが無いので
--   Web は同じ JSON をここに置く。
--
--   2026-09 のストア廃止後、ユーザーの判断で「保存数で差をつける」ことにした:
--   無料(basic)と play は上限あり、Pro は無制限。上限の数値は
--   character_sheet_limit() の 1 か所だけにあるので、変えるときはそこを直す。
--
-- 設計:
--   - 1 行 = 1 キャラ。data に CharacterSheet / GenericSheet(@trpg/core)を
--     そのまま jsonb で持つ。一覧に出す項目(name / system / thumbnail / 更新日時)
--     だけ列に持ち上げ、一覧で巨大な data を読まずに済むようにする。
--   - 立ち絵は data URL を埋めず、play バケットの URL にしてから保存する
--     (lib/sheets/io.ts)。thumbnail は一覧用の小さな画像。
--   - 上限は BEFORE INSERT トリガで強制する(画面側のチェックはすり抜けられるため)。
--     同時保存で上限を 1 つ超えないよう、ユーザー単位の advisory lock を取る。
--     プランを下げても既存のキャラは消さない(新規保存だけ止まる。更新は可)。
--
-- 適用: Supabase Dashboard の SQL Editor か `supabase db push`。破壊的変更なし。
-- =====================================================================

create table if not exists public.character_sheets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  -- 'coc' = CoC 専用エディタ / 'generic' = SystemDef 駆動の汎用エディタ
  kind         text not null check (kind in ('coc', 'generic')),
  system_id    text not null default '',
  -- 表示用のシステム名(保存時に確定)。
  system_name  text,
  name         text not null default '',
  -- 一覧カードの小さなサムネ(data URL か公開 URL)。
  thumbnail    text,
  data         jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists character_sheets_owner_updated_idx
  on public.character_sheets (owner_id, updated_at desc);

alter table public.character_sheets enable row level security;

drop policy if exists "character_sheets_select_own" on public.character_sheets;
create policy "character_sheets_select_own"
  on public.character_sheets for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "character_sheets_insert_own" on public.character_sheets;
create policy "character_sheets_insert_own"
  on public.character_sheets for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "character_sheets_update_own" on public.character_sheets;
create policy "character_sheets_update_own"
  on public.character_sheets for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "character_sheets_delete_own" on public.character_sheets;
create policy "character_sheets_delete_own"
  on public.character_sheets for delete to authenticated
  using (owner_id = auth.uid());

drop trigger if exists character_sheets_set_updated_at on public.character_sheets;
create trigger character_sheets_set_updated_at
  before update on public.character_sheets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 保存数の上限(プラン別)。null = 無制限。
--   admin / pro : 無制限
--   それ以外     : 10 体(basic / play 共通。数値はここだけ)
-- 他人のプランを探れないよう、直接の実行権は与えない(下の定義者関数から使う)。
-- ---------------------------------------------------------------------
create or replace function public.character_sheet_limit(p_uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.profiles p
      where p.id = p_uid and (p.is_admin or p.plan = 'pro')
    ) then null
    else 10
  end;
$$;
revoke all on function public.character_sheet_limit(uuid) from public;

create or replace function public.enforce_character_sheet_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lim integer;
  used integer;
begin
  -- 同じユーザーの同時保存を直列化(2 件同時に通って上限を超えるのを防ぐ)。
  perform pg_advisory_xact_lock(hashtext('character_sheets:' || new.owner_id::text));
  lim := public.character_sheet_limit(new.owner_id);
  if lim is null then
    return new;
  end if;
  select count(*) into used from public.character_sheets where owner_id = new.owner_id;
  if used >= lim then
    raise exception 'sheet_limit_reached'
      using errcode = 'P0001', detail = format('limit=%s', lim);
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_character_sheet_limit() from public;

drop trigger if exists character_sheets_enforce_limit on public.character_sheets;
create trigger character_sheets_enforce_limit
  before insert on public.character_sheets
  for each row execute function public.enforce_character_sheet_limit();

-- 画面表示用: 自分の使用数と上限(上限 null = 無制限)。
create or replace function public.my_character_sheet_quota()
returns table (used integer, sheet_limit integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::integer from public.character_sheets where owner_id = auth.uid()),
    public.character_sheet_limit(auth.uid());
$$;
revoke all on function public.my_character_sheet_quota() from public;
grant execute on function public.my_character_sheet_quota() to authenticated;

-- ---------------------------------------------------------------------
-- GRANT(本プロジェクトは RLS に加えてテーブル権限の明示付与が必要)。
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.character_sheets to authenticated;
