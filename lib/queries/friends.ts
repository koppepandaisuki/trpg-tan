import "server-only";
import { createClient } from "@/lib/supabase/server";

/** この時間内に last_seen_at があれば「オンライン」とみなす。 */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export type FriendListItem = {
  id: string;
  displayName: string;
  avatarPath: string | null;
  lastSeenAt: string | null;
  since: string | null;
  online: boolean;
};

type ListFriendsRow = {
  id: string;
  display_name: string | null;
  avatar_path: string | null;
  last_seen_at: string | null;
  since: string | null;
};

/** 自分のフレンド一覧(在席フラグ付き)。RPC list_friends() 経由。 */
export async function listFriends(): Promise<FriendListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("list_friends");
  if (error) {
    console.error("[listFriends] failed", error);
    return [];
  }
  const now = Date.now();
  const rows = (data ?? []) as ListFriendsRow[];
  return rows.map((r) => ({
    id: r.id,
    displayName: r.display_name ?? "",
    avatarPath: r.avatar_path,
    lastSeenAt: r.last_seen_at,
    since: r.since,
    online: r.last_seen_at ? now - new Date(r.last_seen_at).getTime() < ONLINE_WINDOW_MS : false,
  }));
}

export type FriendInviteInfo = {
  inviterId: string;
  displayName: string;
  avatarPath: string | null;
};

type InviteInfoRow = {
  inviter_id: string;
  display_name: string | null;
  avatar_path: string | null;
};

/** 招待トークンの招待主プレビュー(無効なら null)。RPC friend_invite_info() 経由。 */
export async function getFriendInviteInfo(token: string): Promise<FriendInviteInfo | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("friend_invite_info", {
    p_token: token,
  });
  if (error) {
    console.error("[getFriendInviteInfo] failed", error);
    return null;
  }
  const rows = (data ?? []) as InviteInfoRow[];
  const row = rows[0];
  if (!row) return null;
  return {
    inviterId: row.inviter_id,
    displayName: row.display_name ?? "",
    avatarPath: row.avatar_path,
  };
}

/** 自分の有効な招待トークン(無ければ null)。RLS で自分の行のみ。 */
export async function getMyInviteToken(): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("friend_invites")
    .select("token")
    .eq("revoked", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[getMyInviteToken] failed", error);
    return null;
  }
  return data?.token ?? null;
}

/**
 * 自分のフレンド数と上限(上限 null = 無制限)。migration 0051 の my_friend_quota。
 * まだ SQL を当てていない環境では関数が無いので null(画面に出さない)。
 */
export async function getMyFriendQuota(): Promise<{ used: number; limit: number | null } | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("my_friend_quota");
  if (error || !data) return null;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { used?: number | null; friend_limit?: number | null }
    | undefined;
  if (!row) return null;
  return { used: row.used ?? 0, limit: row.friend_limit ?? null };
}
