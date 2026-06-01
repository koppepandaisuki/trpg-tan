-- =====================================================================
-- 0013_profiles_select_published_creators.sql
--
-- B-18: 公開作品を持つ creator の profile を、buyer 認証クライアントが
-- join 経由で SELECT できるようにする RLS ポリシー追加。
--
-- 経緯:
--   D-020 PR3 で `canPurchase` が `products` ← `profiles!creator_id_fkey`
--   を join して creator の `stripe_charges_enabled` / `stripe_account_id`
--   を取得する設計に変更したが、本番テスト購入で
--   「このクリエイターの決済設定が完了していません」が出続けた。
--   原因: profiles の既存 RLS は「自分の行のみ SELECT 可」だったため、
--   buyer から見ると creator の profile join 結果が常に null になり、
--   chargesEnabled が false 扱いとなり creator_not_onboarded ガードが
--   作動していた。
--
--   本番では即時補填の手動 SQL でポリシー追加して凌いだが、新環境構築
--   時に同じ罠を踏むため、正式 migration として repo に固定する。
--
-- 設計:
--   追加するポリシーは「公開作品を 1 件以上持つ creator」の profile に
--   限定して SELECT 許可。authenticated ロールが対象。
--   既存の自己 SELECT ポリシーと OR で評価されるため、本人の SELECT は
--   引き続き可能。
--
--   exposed されるカラム:
--     - stripe_account_id / stripe_charges_enabled(canPurchase が必要)
--     - display_name / bio / avatar_path(ストア表示で既に公開済の情報)
--     - is_creator / is_admin(機微度低、creator は自明)
--
--   非 exposed(行レベルでブロックされる):
--     - 未公開 creator(下書きのみ・全 suspended)の profile
--     - そもそも creator でないユーザーの profile(self-select policy のみ適用)
--
-- 冪等性:
--   policy 名で drop-if-exists → create でリラン可能にする。
-- =====================================================================

drop policy if exists "profiles_select_published_creators" on public.profiles;

create policy "profiles_select_published_creators"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.products
      where products.creator_id = profiles.id
        and products.status = 'published'
    )
  );
