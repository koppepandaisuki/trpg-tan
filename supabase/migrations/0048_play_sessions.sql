-- =====================================================================
-- 0048_play_sessions.sql
-- Web 版 PLAY(セッション卓)の保存先。
--
-- 背景:
--   デスクトップ版は卓(.play = 1 セッション JSON)をローカルファイルに保存し、
--   索引だけ localStorage に持つ(GM のローカルが正)。ブラウザにはファイル
--   システムが無いため、Web 版は同じ JSON を DB に置く。
--
-- 設計:
--   - 1 行 = 1 卓。`scene` に PlayScene(@trpg/core)をそのまま jsonb で持つ。
--   - 一覧(ロビー)のカードに出す項目(title / system / タグ / 駒数 / 更新日時 /
--     サムネ)は列に持ち上げ、一覧クエリで巨大な scene を読まずに済むようにする。
--   - 画像・音声の実体は scene に data URL で埋めず、`play` バケット(0022)へ
--     上げて URL 参照にする。scene 自体は数十 KB に収める運用。
--
-- RLS:
--   所有者(owner_id = auth.uid())のみ全操作可。卓の共有は Realtime broadcast
--   (参加コード)で行うので、参加者に DB 読み取り権は要らない。
--
-- 適用: Supabase Dashboard の SQL Editor か `supabase db push`。破壊的変更なし。
-- =====================================================================

create table if not exists public.play_sessions (
  -- PlayScene.id をそのまま主キーにする(アプリ側で uuid を採番)。
  id           uuid primary key,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  title        text not null default '(無題の卓)',
  system_id    text not null default '',
  -- 表示用に解決済みのシステム名(保存時に確定。全システムで正しく出すため)。
  system_label text,
  tags         text[] not null default '{}',
  -- 一覧カードのサムネイル(前景/背景を縮小した data URL or 公開 URL)。
  thumbnail    text,
  panel_count  integer not null default 0,
  -- 卓の実体(PlayScene)。
  scene        jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ロビーは「自分の卓を更新順に」引く。
create index if not exists play_sessions_owner_updated_idx
  on public.play_sessions (owner_id, updated_at desc);

alter table public.play_sessions enable row level security;

drop policy if exists "play_sessions_select_own" on public.play_sessions;
create policy "play_sessions_select_own"
  on public.play_sessions for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "play_sessions_insert_own" on public.play_sessions;
create policy "play_sessions_insert_own"
  on public.play_sessions for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "play_sessions_update_own" on public.play_sessions;
create policy "play_sessions_update_own"
  on public.play_sessions for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "play_sessions_delete_own" on public.play_sessions;
create policy "play_sessions_delete_own"
  on public.play_sessions for delete to authenticated
  using (owner_id = auth.uid());

-- updated_at を自動更新(アプリ側の入れ忘れでロビーの並びが崩れないように)。
-- 0001 で定義済みの共通ヘルパ set_updated_at() を再利用する。
drop trigger if exists play_sessions_set_updated_at on public.play_sessions;
create trigger play_sessions_set_updated_at
  before update on public.play_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- GRANT
--   本プロジェクトはテーブル権限を明示的に付与する運用(0004〜0012 参照)。
--   RLS は「どの行を触れるか」だけを決めるので、テーブル権限が無いと
--   認証ユーザーでも 42501(permission denied)になる。
--   卓は所有者だけのデータなので anon には一切与えない。
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.play_sessions to authenticated;
