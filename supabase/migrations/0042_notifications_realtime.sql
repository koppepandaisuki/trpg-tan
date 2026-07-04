-- =====================================================================
-- 0042_notifications_realtime.sql
-- notifications テーブルを Supabase Realtime の publication に追加し、
-- postgres_changes(INSERT)をクライアントから購読できるようにする。
--
-- 既存の RLS ポリシー(notifications_select_own: user_id = auth.uid())が
-- Realtime の配信にもそのまま適用されるため、他人の通知が漏れることはない。
-- クライアント側は filter: `user_id=eq.<自分の id>` を併用して二重に絞る
-- (apps/desktop/src/friends-remote.ts の subscribeMyNotifications)。
-- =====================================================================

alter publication supabase_realtime add table public.notifications;
