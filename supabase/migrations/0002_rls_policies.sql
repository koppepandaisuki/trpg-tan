-- =====================================================================
-- 0002_rls_policies.sql
-- TRPG プラットフォーム MVP — RLS有効化 + ポリシー定義
--
-- ポリシー方針:
--   - 全アプリテーブルで RLS を有効化する
--   - 「明示的に許可するもの」だけを CREATE POLICY する(暗黙deny)
--   - INSERT / UPDATE / DELETE のうちポリシーが無い操作はクライアントから不可
--   - ロール判定は public.is_admin() / public.is_creator() 経由
--     (profiles の RLS から profiles を見て無限再帰するのを避けるため)
--   - service_role は RLS をバイパスする(Supabase標準)。Webhookハンドラや
--     adminの監査ログ書き込みは service_role 経由で行う。
-- =====================================================================


-- ---------------------------------------------------------------------
-- RLS の有効化
-- ---------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.products             enable row level security;
alter table public.product_tags         enable row level security;
alter table public.purchases            enable row level security;
alter table public.creator_applications enable row level security;
alter table public.admin_audit_logs     enable row level security;


-- =====================================================================
-- profiles
-- =====================================================================

-- SELECT: 本人 OR admin
--   公開プロフィール表示は public_profiles ビュー経由(RLSを回避するビュー)
create policy profiles_select_self_or_admin
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- INSERT: クライアントからは禁止
--   profiles 行は handle_new_user() トリガーで自動生成される。
--   → ポリシーを作らないことで、クライアントからの全 INSERT が拒否される。

-- UPDATE: 本人(ただし is_creator / is_admin の変更は不可)
--   WITH CHECK で「サブクエリ経由の現在値」と一致しているかを検査することで、
--   本人が自分で is_creator / is_admin を立てることを防ぐ。
create policy profiles_update_self_safe_columns
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and is_creator = (select p.is_creator from public.profiles p where p.id = auth.uid())
    and is_admin   = (select p.is_admin   from public.profiles p where p.id = auth.uid())
  );

-- UPDATE: admin は全カラム可
create policy profiles_update_admin
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- DELETE: クライアントからは禁止
--   auth.users の cascade のみで profiles 行は消える。
--   → ポリシーを作らない。


-- =====================================================================
-- public_profiles ビュー
-- =====================================================================

-- ビュー(security_invoker = off)に対する SELECT 権限を anon / authenticated に付与
grant select on public.public_profiles to anon, authenticated;


-- =====================================================================
-- products
-- =====================================================================

-- SELECT: 公開作品は誰でも
create policy products_select_published
  on public.products for select
  using (status = 'published');

-- SELECT: creator は自作の全状態(draft も含む)
create policy products_select_own
  on public.products for select
  using (creator_id = auth.uid());

-- SELECT: admin は全件
create policy products_select_admin
  on public.products for select
  using (public.is_admin());

-- INSERT: creator(is_creator=true)が自分名義で draft 状態のみ作成可
--   status='published' を直接 INSERT させない(公開遷移は UPDATE 経路のみ)
create policy products_insert_own_draft
  on public.products for insert
  with check (
    public.is_creator()
    and creator_id = auth.uid()
    and status = 'draft'
  );

-- UPDATE: creator は自作のみ更新可。
--   ただし suspended への遷移は creator からは不可。
--   creator が許される status 遷移: draft <-> published
create policy products_update_own
  on public.products for update
  using (creator_id = auth.uid())
  with check (
    creator_id = auth.uid()
    and status in ('draft', 'published')
  );

-- UPDATE: admin は全件・全 status へ遷移可
create policy products_update_admin
  on public.products for update
  using (public.is_admin())
  with check (public.is_admin());

-- DELETE: creator は自作の draft のみ削除可
--   購入履歴がある場合は FK on delete restrict で DB レベルで拒否される(二重防御)
create policy products_delete_own_draft
  on public.products for delete
  using (creator_id = auth.uid() and status = 'draft');

-- DELETE: admin
--   admin も購入履歴がある作品は FK restrict で削除不可。
--   完全消去ではなく status='suspended' での運用が正しい。
create policy products_delete_admin
  on public.products for delete
  using (public.is_admin());


-- =====================================================================
-- product_tags
-- =====================================================================

-- SELECT: 親 product が SELECT 可なら可
create policy product_tags_select
  on public.product_tags for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_tags.product_id
        and (
          p.status = 'published'
          or p.creator_id = auth.uid()
          or public.is_admin()
        )
    )
  );

-- INSERT: 親 product の creator 自身、または admin
create policy product_tags_insert_own_or_admin
  on public.product_tags for insert
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_tags.product_id
        and (p.creator_id = auth.uid() or public.is_admin())
    )
  );

-- DELETE: 親 product の creator 自身、または admin
create policy product_tags_delete_own_or_admin
  on public.product_tags for delete
  using (
    exists (
      select 1 from public.products p
      where p.id = product_tags.product_id
        and (p.creator_id = auth.uid() or public.is_admin())
    )
  );

-- UPDATE: クライアント不可(タグ変更は delete + insert)


-- =====================================================================
-- purchases
-- =====================================================================

-- SELECT: 自分の購入(退会後 user_id=null のレコードはこのポリシーでは見えない)
create policy purchases_select_own
  on public.purchases for select
  using (user_id is not null and user_id = auth.uid());

-- SELECT: creator は自作の販売記録を参照可
--   /creator/sales での売上集計に必要
create policy purchases_select_creator
  on public.purchases for select
  using (
    exists (
      select 1 from public.products p
      where p.id = purchases.product_id
        and p.creator_id = auth.uid()
    )
  );

-- SELECT: admin は全件
create policy purchases_select_admin
  on public.purchases for select
  using (public.is_admin());

-- INSERT / UPDATE / DELETE: クライアント不可
--   Stripe Webhook(service_role)のみが書く。
--   → ポリシーを作らないことで全クライアント書き込みが拒否される。


-- =====================================================================
-- creator_applications
-- =====================================================================

-- SELECT: 本人 OR admin
create policy creator_applications_select_own
  on public.creator_applications for select
  using (applicant_id = auth.uid());

create policy creator_applications_select_admin
  on public.creator_applications for select
  using (public.is_admin());

-- INSERT: 本人のみ。status='pending' で開始、reviewed_* は触れない。
--   既存の pending がある場合は creator_applications_one_pending_per_user
--   (部分UNIQUE)で DB が拒否する。
create policy creator_applications_insert_self
  on public.creator_applications for insert
  with check (
    applicant_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

-- UPDATE: admin のみ
create policy creator_applications_update_admin
  on public.creator_applications for update
  using (public.is_admin())
  with check (public.is_admin());

-- DELETE: クライアント不可


-- =====================================================================
-- admin_audit_logs
-- =====================================================================

-- SELECT: admin のみ
create policy admin_audit_logs_select_admin
  on public.admin_audit_logs for select
  using (public.is_admin());

-- INSERT / UPDATE / DELETE: クライアント不可
--   admin の操作実行は Server Action 内で service_role で監査ログを書く運用とする。
