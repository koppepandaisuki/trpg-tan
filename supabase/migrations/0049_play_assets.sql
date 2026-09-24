-- =====================================================================
-- 0049_play_assets.sql
-- ライブラリの「素材」(画像・音声)の索引。
--
-- 背景:
--   2026-09 にストア(作品売買)を廃止し、ライブラリは「自分の卓 + 素材」の
--   保管庫に再定義した。卓は play_sessions(0048)にあるが、素材の実体は
--   `play` バケット(0022)に `<owner_id>/<sha256>.<ext>` で置かれているだけで、
--     - ファイル名が内容ハッシュなので人が読める名前が無い
--     - バケットに SELECT ポリシーが無く、本人でも一覧できない
--   ため、ライブラリとして並べられなかった。本テーブルはその索引。
--
-- 設計:
--   - 1 行 = 1 ファイル(owner_id + path で一意)。同じファイルを何度上げても
--     内容ハッシュが同じなので 1 行に集約される。
--   - 卓でアップロードした素材も自動でここに登録される(lib/play/media.ts)。
--   - 行を消しても Storage の実体は消さない。卓の scene が URL を参照している
--     可能性があり、消すとその卓の画像・音が切れるため(「ライブラリから外す」)。
--
-- RLS:
--   所有者(owner_id = auth.uid())のみ全操作可。素材は自分専用の保管庫。
--
-- 適用: Supabase Dashboard の SQL Editor か `supabase db push`。破壊的変更なし。
-- =====================================================================

create table if not exists public.play_assets (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('image', 'audio')),
  -- 表示名(アップロード時のファイル名から拡張子を除いたもの。変更可)。
  name        text not null check (char_length(name) between 1 and 80),
  -- Storage 上のパス(`<owner_id>/<sha256>.<ext>`)。
  path        text not null,
  -- 公開 URL(卓の scene に入れる値そのもの)。
  url         text not null,
  size_bytes  bigint not null default 0,
  mime        text,
  created_at  timestamptz not null default now(),
  unique (owner_id, path)
);

-- ライブラリは「自分の素材を新しい順に(種類で絞り込み)」引く。
create index if not exists play_assets_owner_kind_created_idx
  on public.play_assets (owner_id, kind, created_at desc);

alter table public.play_assets enable row level security;

drop policy if exists "play_assets_select_own" on public.play_assets;
create policy "play_assets_select_own"
  on public.play_assets for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "play_assets_insert_own" on public.play_assets;
create policy "play_assets_insert_own"
  on public.play_assets for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "play_assets_update_own" on public.play_assets;
create policy "play_assets_update_own"
  on public.play_assets for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "play_assets_delete_own" on public.play_assets;
create policy "play_assets_delete_own"
  on public.play_assets for delete to authenticated
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- GRANT
--   本プロジェクトは RLS に加えてテーブル権限の明示付与が必要(0004〜0012、
--   0048 も付け忘れて 42501 になった)。素材は本人専用なので anon には与えない。
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.play_assets to authenticated;
