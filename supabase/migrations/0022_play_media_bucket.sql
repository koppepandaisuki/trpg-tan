-- =====================================================================
-- 0022_play_media_bucket.sql
-- PLAY(セッション卓)のメディア用 Storage バケット作成 + RLS
--
-- 背景:
--   マルチ同期はこれまで画像/音声を base64 で卓データに埋め込み、Supabase
--   Realtime の broadcast で送っていた。数 MB を 60KB チャンク + ack で直列
--   送信するため非常に遅かった。本 migration で「メディアは Storage に置いて
--   URL で共有」する経路を開設する(Realtime には小さな JSON だけ流す)。
--
-- バケット仕様:
--   id   = "play"
--   public = true(参加者は誰でも公開 URL から取得 = CDN キャッシュ)
--   path パターン: `<user_id>/<sha256>.<ext>`(内容ハッシュで重複排除)
--   file_size_limit = 25 MB(BGM 等の音声も入るため大きめ)
--
-- RLS:
--   INSERT/UPDATE は path 第 1 セグメント = auth.uid() を要求(自分のフォルダ
--   のみ書ける。avatars/covers と同じ思想)。SELECT は public バケットなので
--   policy 不要(getPublicUrl が署名なしで機能)。
--
-- 適用: Supabase Dashboard の SQL Editor か `supabase db push`。破壊的変更なし。
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('play', 'play', true, 25 * 1024 * 1024)
on conflict (id) do update set
  public          = excluded.public,
  file_size_limit = excluded.file_size_limit;

create policy "play_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'play'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "play_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'play'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'play'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
