import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * フレンド機能の書き込み(招待トークン発行/失効、承認、解除、在席心拍)。
 * RLS は friend_invites=自分の行のみ、friendships=承認 RPC のみ作成、で守る。
 */

/** 自分の有効な招待トークンを取得。無ければ作成して返す。 */
export async function ensureMyInviteToken(): Promise<string> {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("friend_invites")
    .select("token")
    .eq("revoked", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.token) return existing.token;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const { data, error } = await supabase
    .from("friend_invites")
    .insert({ inviter_id: user.id })
    .select("token")
    .single();
  if (error || !data) {
    throw new Error(`ensureMyInviteToken failed: ${error?.message}`);
  }
  return data.token;
}

/** 既存トークンを失効し、新しいトークンを発行して返す。 */
export async function regenerateMyInviteToken(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  await supabase
    .from("friend_invites")
    .update({ revoked: true })
    .eq("inviter_id", user.id)
    .eq("revoked", false);

  const { data, error } = await supabase
    .from("friend_invites")
    .insert({ inviter_id: user.id })
    .select("token")
    .single();
  if (error || !data) {
    throw new Error(`regenerateMyInviteToken failed: ${error?.message}`);
  }
  return data.token;
}

/** 招待トークンを承認してフレンド成立。招待主 id を返す(無効なら null)。 */
export async function acceptFriendInvite(token: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("accept_friend_invite", {
    p_token: token,
  });
  if (error) {
    console.error("[acceptFriendInvite] failed", error);
    throw new Error(error.message);
  }
  return (data as string | null) ?? null;
}

/** フレンド解除(無向辺を削除)。RLS で当事者のみ。 */
export async function removeFriend(otherId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const [low, high] =
    user.id < otherId ? [user.id, otherId] : [otherId, user.id];
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("user_low", low)
    .eq("user_high", high);
  if (error) throw new Error(`removeFriend failed: ${error.message}`);
}

/** 在席の心拍。自分の last_seen_at を now() に更新(RPC)。失敗は握りつぶす。 */
export async function touchPresence(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("touch_presence");
  if (error) console.error("[touchPresence] failed", error);
}
