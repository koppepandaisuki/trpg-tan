-- 0037: 商品ギャラリーに動画を挿入できるようにする
--
-- screenshots バケット(0017 で作成)の許可 MIME に mp4 / webm を追加し、
-- ファイルサイズ上限を 50MB に引き上げる(動画対応)。
-- 画像の実質上限(5MB)はアプリ側 (lib/format/upload.ts) で検証する。

update storage.buckets
set
  file_size_limit = 52428800, -- 50 MB
  allowed_mime_types = array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4',
    'video/webm'
  ]
where id = 'screenshots';
