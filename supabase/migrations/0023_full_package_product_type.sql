-- =====================================================================
-- 0023_full_package_product_type.sql
-- 「フルパッケージ」(完成品ゲーム = .paradice 一式)を商品タイプに追加。
--
-- このサイトの強み = ビルダーで作ったゲームをそのまま売り買いできること。
-- その目玉商品タイプ 'full_package' と、配布ファイル形式 'pack'(.paradice)を
-- products の CHECK 制約に足す。
--
-- 既存の列レベル CHECK は Postgres が `<table>_<column>_check` で自動命名する。
-- それを張り替える(値を増やすだけ。既存データは破壊しない)。
-- 適用: Supabase Dashboard SQL Editor か `supabase db push`。
-- =====================================================================

alter table public.products drop constraint if exists products_product_type_check;
alter table public.products
  add constraint products_product_type_check check (
    product_type in (
      'full_package',
      'scenario',
      'rulebook',
      'character_art',
      'map',
      'bgm_audio'
    )
  );

alter table public.products drop constraint if exists products_file_format_check;
alter table public.products
  add constraint products_file_format_check check (
    file_format in ('pdf', 'image_zip', 'audio', 'pack')
  );
