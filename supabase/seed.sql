-- =====================================================================
-- seed.sql
-- 開発環境用のダミーデータ。本番では実行しないこと。
--
-- 前提:
--   profiles 行は handle_new_user() トリガーで auth.users INSERT 時に
--   自動生成される。したがって seed では「Supabase Studio で事前作成した
--   ユーザーの UUID」を変数に置き換えてから実行する。
--
-- 手順:
--   1. Supabase Studio > Authentication でユーザーを 3 名作成する
--        alice@example.com  (creator になる)
--        bob@example.com    (creator になる)
--        carol@example.com  (admin になる)
--   2. 各ユーザーの UUID を控える
--   3. 下の do $$ ブロック内の `alice` / `bob` / `carol` の UUID を実値に
--      置き換える
--   4. このファイルを psql / Supabase SQL Editor で実行する
--
-- 注意:
--   このファイルは service_role 等の高権限で実行する想定。
--   RLS をバイパスするため、開発以外では絶対に流さない。
-- =====================================================================

do $$
declare
  -- !!! 実環境の UUID に書き換えること !!!
  alice uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  bob   uuid := '00000000-0000-0000-0000-000000000002'::uuid;
  carol uuid := '00000000-0000-0000-0000-000000000003'::uuid;

  product_archive  uuid := gen_random_uuid();
  product_map      uuid := gen_random_uuid();
  product_draft    uuid := gen_random_uuid();
begin
  -- ------------------------------------------------------------------
  -- profiles の更新(行は trigger で既に存在しているはず)
  -- ------------------------------------------------------------------
  update public.profiles
     set display_name = 'Alice',
         is_creator   = true
   where id = alice;

  update public.profiles
     set display_name = 'Bob',
         is_creator   = true
   where id = bob;

  update public.profiles
     set display_name = 'Carol',
         is_admin     = true
   where id = carol;

  -- ------------------------------------------------------------------
  -- products
  --   2 件 published, 1 件 draft
  -- ------------------------------------------------------------------
  insert into public.products (
    id, creator_id, slug, title, description,
    product_type, file_format, price_jpy, status,
    system_label, players, playtime,
    allow_commercial, allow_redistribution, published_at
  ) values
  (
    product_archive, alice, 'twilight-archive',
    '黄昏のアーカイブ',
    '古い図書館の奥で、封印された記録を見つける――ホラーミステリーシナリオ。',
    'scenario', 'pdf', 1500, 'published',
    'クトゥルフ神話TRPG(第7版)', '1〜4人', '3〜5時間',
    false, false, now() - interval '7 days'
  ),
  (
    product_map, bob, 'ancient-ruins-map-pack',
    '古代遺跡バトルマップ集',
    '汎用バトルマップ素材集。30枚収録。',
    'map', 'image_zip', 800, 'published',
    '汎用', null, null,
    true, false, now() - interval '3 days'
  ),
  (
    product_draft, alice, 'modern-horror-supplement-draft',
    '(下書き)モダンホラーTRPG サプリメント',
    '執筆中のサプリメント。まだ公開していません。',
    'rulebook', 'pdf', 2500, 'draft',
    'オリジナルTRPG', null, null,
    false, false, null
  );

  -- ------------------------------------------------------------------
  -- product_tags
  --   タグは lower 正規化済みで投入する
  -- ------------------------------------------------------------------
  insert into public.product_tags (product_id, tag) values
    (product_archive, 'coc'),
    (product_archive, 'horror'),
    (product_archive, 'investigation'),
    (product_map,     'map'),
    (product_map,     'dungeon');

  -- ------------------------------------------------------------------
  -- purchases
  --   carol が product_archive を購入済み(paid)
  -- ------------------------------------------------------------------
  insert into public.purchases (
    user_id, product_id, stripe_session_id, amount_jpy, status, paid_at
  ) values (
    carol, product_archive, 'cs_test_seed_carol_archive',
    1500, 'paid', now() - interval '2 days'
  );

  -- ------------------------------------------------------------------
  -- creator_applications (任意。UI 動作確認用に 1 件 pending を入れる)
  -- ------------------------------------------------------------------
  -- ※ carol はすでに admin だが、申請テーブル自体の動作確認のためダミーで投入。
  --   実運用では carol のように既に creator/admin の人が申請する状況は無い。
  insert into public.creator_applications (
    applicant_id, reason, status
  ) values (
    carol,
    'テスト用申請レコード(seed)。本来は creator フラグの無いユーザーが投稿する。',
    'pending'
  );
end $$;
