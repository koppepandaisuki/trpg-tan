-- 0033_product_files_mime.sql
--
-- 出品(.paradice アップロード)が "mime type application/json is not supported"
-- で失敗する不具合の修正。
--
-- product-files バケットは手動作成時に allowed_mime_types が限定されており、
-- .paradice の実体である application/json を受け付けられなかった。
-- このバケットは private かつ署名付き URL 限定(0007_storage_rls.sql)でアクセス
-- されるため、MIME 制限による防御価値は低い。将来 .paradice が JSON / zip /
-- octet-stream のいずれで配布されても通るよう、許可 MIME 制限を解除する。
--
-- file_size_limit は据え置き(ここでは触らない)。

update storage.buckets
set allowed_mime_types = null
where id = 'product-files';
