-- =====================================================================
-- 0029_review_stars.sql
-- レビューを「高評価/低評価」の二択から「5 段階の星評価」へ拡張する。
--
-- 仕様:
--   - product_reviews に stars smallint (1..5) を追加
--   - 既存レビューを backfill(positive -> 5 / negative -> 2)
--   - backfill 後に NOT NULL を付与
--   - 旧 rating 列は後方互換のため残す(新規 insert では stars から導出した
--     値を書き込む。集計・ラベルは stars の平均で算出する)
--
-- RLS は 0016 のまま(購入済みのみ insert / 自分のみ update,delete /
-- 読み取りは全許可)。stars 追加に伴うポリシー変更は不要。
-- =====================================================================

alter table public.product_reviews
  add column if not exists stars smallint
    check (stars is null or (stars between 1 and 5));

-- 既存行を rating から backfill(positive=5 / negative=2)。
update public.product_reviews
  set stars = case when rating = 'positive' then 5 else 2 end
  where stars is null;

-- 以降は必須化(全行 backfill 済みの想定)。
alter table public.product_reviews
  alter column stars set not null;

-- 平均星の算出を速くするための補助 index(product 単位の集計用)。
create index if not exists product_reviews_product_stars_idx
  on public.product_reviews (product_id, stars);
