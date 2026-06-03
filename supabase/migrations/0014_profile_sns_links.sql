-- =====================================================================
-- 0014_profile_sns_links.sql
-- profiles に SNS リンク欄を追加 + public_profiles view を更新
--
-- 背景:
--   MMM(クリエイタープロフィールページ)を導入したので、creator が
--   外部 SNS / Web サイトへの導線を出せるようにする。α 期間中は最小限
--   の 2 種(Twitter / Web サイト)だけサポート。
--
-- 追加列:
--   twitter_handle text  -- 「@」抜きのハンドル(例: "shu_trpg")
--   website_url    text  -- フル URL(例: "https://example.com")
--
-- どちらも nullable ではなく default '' で「未設定 = 空文字」とする
-- (既存の bio / display_name と同じパターン)。表示側で truthy 判定。
--
-- 文字数上限:
--   twitter_handle: 50(Twitter 公式は 15 字だが、将来の Bluesky 等を
--                       考慮して少し余裕を持たせる)
--   website_url:    200(URL の現実的上限)
--
-- view 更新:
--   public_profiles に両カラムを追加して、anon でも閲覧できるように。
--   security_invoker = off は維持(既存と同じ挙動)。
-- =====================================================================

alter table public.profiles
  add column twitter_handle text not null default ''
    check (char_length(twitter_handle) <= 50),
  add column website_url    text not null default ''
    check (char_length(website_url) <= 200);


-- ---------------------------------------------------------------------
-- public_profiles ビューを再作成(列追加のため or replace では足りない)
-- ---------------------------------------------------------------------
drop view if exists public.public_profiles;

create or replace view public.public_profiles
with (security_invoker = off) as
select
  id,
  display_name,
  avatar_path,
  bio,
  twitter_handle,
  website_url
from public.profiles;

-- View 権限は 0004_grant_profiles で anon / authenticated に SELECT が
-- 付与済みなので、ここで再付与する必要はない(view を drop / create する
-- だけで GRANT は引き継がれない可能性があるため、念のため再付与)。
grant select on public.public_profiles to anon, authenticated;
