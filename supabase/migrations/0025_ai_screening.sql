-- =====================================================================
-- 0025_ai_screening.sql
--
-- AI 事前審査(モデレーション)の結果を作品に保存する列。
--
-- 出品が審査に出される(pending)タイミングで、タイトル / 説明 / タグを AI で
-- 一次判定し、その結果を admin の審査キューに表示してトリアージを助ける。
-- これは**助言**であり、公開/却下の最終判断は人間(admin)が行う。
-- 自動公開・自動却下はしない。
--
-- 値:
--   ai_verdict   allow | flag | block | skipped | error
--   ai_reason    日本語の理由(admin 向け)
--   ai_checked_at 判定時刻
-- =====================================================================

alter table public.products
  add column if not exists ai_verdict text
    check (ai_verdict in ('allow', 'flag', 'block', 'skipped', 'error'));
alter table public.products add column if not exists ai_reason text;
alter table public.products add column if not exists ai_checked_at timestamptz;

-- 審査待ちのうち AI が懸念ありとしたものを優先的に拾うための部分索引。
create index if not exists products_pending_ai_idx
  on public.products (ai_verdict)
  where status = 'pending';
