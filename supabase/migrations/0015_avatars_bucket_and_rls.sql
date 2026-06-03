-- =====================================================================
-- 0015_avatars_bucket_and_rls.sql
-- avatars Storage バケット作成 + RLS policies
--
-- 背景:
--   profiles.avatar_path は 0001 から存在するが、Storage バケット側の
--   設定は MVP では未着手だった(0007 のコメント参照)。UUU PR で
--   creator プロフィール編集を導入したので、アバター画像の実アップロード
--   経路を本 migration で開設する。
--
-- バケット仕様:
--   id   = "avatars"
--   public = true  (誰でも読める = profiles の閲覧経路と整合)
--   pathパターン: `<user_id>/<timestamp>.{ext}`
--
-- RLS:
--   INSERT/UPDATE/DELETE は path の第 1 セグメント = auth.uid() を要求
--   (他人の avatar を書き換えられない、cover の policy と同じ思想)
--
--   SELECT(read) policy は明示しない:
--     public バケットなので Supabase Storage が anon に公開する。RLS で
--     SELECT を許可する必要はなく、署名なしで getPublicUrl が機能する。
--
-- 適用:
--   Supabase Dashboard SQL Editor or `supabase db push`。
--   既存ユーザーは avatar_path が NULL のままなので破壊的変更なし。
-- =====================================================================


-- ---------------------------------------------------------------------
-- avatars バケット作成
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2 * 1024 * 1024,  -- 2 MB ハードキャップ(server 側の検証と合わせる)
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public            = excluded.public,
  file_size_limit   = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ---------------------------------------------------------------------
-- RLS policies(直接アップロード経路の二重防御)
-- signed upload URL 経由は service_role が RLS をバイパスするが、
-- anon key + JWT で直接 .upload() を叩かれたときに他人のフォルダに
-- 書き込めないよう policy を張る(0007 の covers と同じ思想)。
-- ---------------------------------------------------------------------
create policy "avatars_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
