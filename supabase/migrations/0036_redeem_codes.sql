-- 0036_redeem_codes.sql
--
-- リデームコード(引き換えコード)。特定のコード入力で
--   - plan_play / plan_pro … プランを付与(ダウングレードはしない)
--   - gold                 … アプリ内ゴールドを付与(profiles.gold_balance)
--
-- コードの作成は当面 SQL(service_role)で行う:
--   insert into public.redeem_codes (code, kind, amount, max_uses, expires_at, note)
--   values ('LAUNCH2026', 'gold', 500, 100, '2026-08-01', 'ローンチ記念');
--
-- セキュリティ: 両テーブルとも RLS 有効 + ポリシー無し = service_role のみが
-- 読み書きできる。適用は POST /api/redeem がサーバ側で行う。

-- アプリ内ゴールド残高(将来のストア内通貨。付与のみ、消費はまだ)。
alter table public.profiles
  add column if not exists gold_balance integer not null default 0
    check (gold_balance >= 0);

create table if not exists public.redeem_codes (
  code        text primary key,      -- 保存時に大文字へ正規化
  kind        text not null check (kind in ('plan_play', 'plan_pro', 'gold')),
  amount      integer not null default 0 check (amount >= 0), -- gold の付与額
  max_uses    integer not null default 1 check (max_uses >= 1),
  used_count  integer not null default 0,
  expires_at  timestamptz,           -- null = 無期限
  note        text,
  created_at  timestamptz not null default now()
);
alter table public.redeem_codes enable row level security;

create table if not exists public.code_redemptions (
  id         uuid primary key default gen_random_uuid(),
  code       text not null references public.redeem_codes(code) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (code, user_id)             -- 同一コードは 1 人 1 回
);
alter table public.code_redemptions enable row level security;
