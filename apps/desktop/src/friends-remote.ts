/**
 * フレンド & 通知に関する Supabase RPC ラッパー(デスクトップから直叩き)。
 *
 * Supabase が未設定(VITE_SUPABASE_URL 等がスタブ)の環境では各関数が
 * "supabase not configured" を投げる。呼び出し側は loggedIn を確認してから使う。
 */

import { supabase, supabaseConfigured } from "./supabase";

export interface FriendUserPreview {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface NotificationRow {
  id: string;
  kind:
    | "friend_request"
    | "friend_accepted"
    | "table_invite"
    | "schedule_invite"
    | "tip_received"
    | "product_review"
    | "review_decision";
  payload: Record<string, unknown>;
  readAt: string | null;
  respondedAt: string | null;
  createdAt: string;
}

function ensure(): void {
  if (!supabaseConfigured) throw new Error("supabase not configured");
}

function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

/** 自分のフレンドコードを取得(無ければ生成)。 */
export async function ensureMyFriendCode(): Promise<string> {
  ensure();
  const { data, error } = await supabase.rpc("ensure_my_friend_code");
  if (error) throw new Error(error.message);
  return String(data);
}

/** フレンドコードからユーザーを検索(送信前プレビュー用)。 */
export async function findUserByFriendCode(
  code: string,
): Promise<FriendUserPreview | null> {
  ensure();
  const { data, error } = await supabase.rpc("find_user_by_friend_code", {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    id: string;
    display_name: string | null;
    avatar_path: string | null;
  }[];
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    displayName: r.display_name ?? "",
    avatarUrl: avatarUrl(r.avatar_path),
  };
}

/** フレンド申請を送る。null=既にフレンド or 直近に同じ申請あり。 */
export async function sendFriendRequest(targetId: string): Promise<string | null> {
  ensure();
  const { data, error } = await supabase.rpc("send_friend_request", {
    p_target: targetId,
  });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

/** 自分宛のフレンド申請に応答する。 */
export async function respondFriendRequest(
  notificationId: string,
  accept: boolean,
): Promise<void> {
  ensure();
  const { error } = await supabase.rpc("respond_friend_request", {
    p_notification: notificationId,
    p_accept: accept,
  });
  if (error) throw new Error(error.message);
}

/** 卓の参加コードをフレンドに通知。 */
export async function sendTableInvite(
  targetId: string,
  code: string,
  tableName: string,
): Promise<void> {
  ensure();
  const { error } = await supabase.rpc("send_table_invite", {
    p_target: targetId,
    p_code: code,
    p_table_name: tableName,
  });
  if (error) throw new Error(error.message);
}

/** 日程調整の招待をフレンドに送る。 */
export async function sendScheduleInvite(
  eventId: string,
  targetId: string,
  title: string,
  publicToken: string,
): Promise<void> {
  ensure();
  const { error } = await supabase.rpc("send_schedule_invite", {
    p_event_id: eventId,
    p_target: targetId,
    p_title: title,
    p_public_token: publicToken,
  });
  if (error) throw new Error(error.message);
}

/** 自分宛の通知一覧(新しい順)。limit はクライアント側で先頭 N 件。 */
export async function listMyNotifications(
  limit = 40,
): Promise<NotificationRow[]> {
  ensure();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, payload, read_at, responded_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as {
    id: string;
    kind: NotificationRow["kind"];
    payload: Record<string, unknown> | null;
    read_at: string | null;
    responded_at: string | null;
    created_at: string;
  }[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    payload: r.payload ?? {},
    readAt: r.read_at,
    respondedAt: r.responded_at,
    createdAt: r.created_at,
  }));
}

/** 未読件数(バッジ用)。 */
export async function myUnreadCount(): Promise<number> {
  ensure();
  const { data, error } = await supabase.rpc("my_unread_count");
  if (error) throw new Error(error.message);
  return Number(data) || 0;
}

/** 通知を既読にする(複数 ID 同時)。 */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  ensure();
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .is("read_at", null);
  if (error) throw new Error(error.message);
}

/** 通知を削除。 */
export async function deleteNotification(id: string): Promise<void> {
  ensure();
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type FriendAvailabilityRow = {
  dateIso: string;
  yesCount: number;
  noCount: number;
  maybeCount: number;
};

/**
 * 「指定フレンドが既に他の調整で yes/no/maybe を入れている日」の集計。
 * 日程調整作成画面の「空き時間レコメンド」用。
 */
export async function fetchFriendDateAvailability(
  friendIds: string[],
  dates: string[],
): Promise<FriendAvailabilityRow[]> {
  ensure();
  if (friendIds.length === 0 || dates.length === 0) return [];
  const { data, error } = await supabase.rpc("friend_date_availability", {
    p_friend_ids: friendIds,
    p_dates: dates,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as {
    date_iso: string;
    yes_count: number;
    no_count: number;
    maybe_count: number;
  }[]).map((r) => ({
    dateIso: r.date_iso,
    yesCount: r.yes_count ?? 0,
    noCount: r.no_count ?? 0,
    maybeCount: r.maybe_count ?? 0,
  }));
}
