-- =====================================================================
-- 0006_storage_rls.sql
-- Phase: file upload feature, Ph-α
--
-- Storage RLS for `covers` + `product-files` buckets.
--
-- 仕様(decisions.md の Q6 / G-2 を反映):
--   - signed upload URL 経由のアップロード(本 MVP の正規経路)は Supabase
--     が事前承認するため RLS をバイパスする
--   - したがって RLS は「signed URL を経由せず、anon key + JWT で直接
--     supabase.storage.from(...).upload(...) を叩いてくる経路」に対する
--     二重防御として機能する
--   - path の第 1 セグメントが auth.uid() に一致することを INSERT/UPDATE
--     /DELETE で要求 → 他人の creator_id 配下に書き込めない
--
-- 意図的に作らない/触らないもの:
--   - SELECT(read) ポリシー
--       * covers は public-read バケット(バケット設定側で制御)
--       * product-files は signed URL only(lib/storage/signed-url.ts)。
--         direct read を許す経路を作らないので、RLS で SELECT を許可する
--         policy も書かない(= read は完全に拒否される)
--   - storage.objects への RLS 有効化(Supabase デフォルトで有効済)
--   - avatars バケット(MVP では未使用)
--
-- 適用方法: 他の migration と同様に Supabase Studio の SQL Editor、もしくは
-- `supabase db push` で反映する。
-- =====================================================================


-- ---------------------------------------------------------------------
-- covers バケット
-- path 例: `<creator_id>/<product_id>.webp`
-- (storage.objects.name には bucket 名を含めない)
-- ---------------------------------------------------------------------

create policy "covers_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "covers_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "covers_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ---------------------------------------------------------------------
-- product-files バケット(private)
-- path 例: `<creator_id>/<product_id>.pdf`
-- ---------------------------------------------------------------------

create policy "product_files_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "product_files_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "product_files_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
