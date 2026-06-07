import "server-only";
import { createClient } from "@/lib/supabase/server";
import { publicAvatarUrl } from "@/lib/format/storage";

/** クリエイターのフォロー状態(プロフィールの「フォロー」ボタン用)。 */
export interface CreatorFollowState {
  count: number;
  isFollowing: boolean;
  isSelf: boolean;
  isAuthed: boolean;
}

export async function getCreatorFollowState(
  creatorId: string,
): Promise<CreatorFollowState> {
  const supabase = createClient();

  // フォロワー数(誰でも参照可: RLS は select using(true))
  const { count } = await supabase
    .from("creator_follows")
    .select("*", { count: "exact", head: true })
    .eq("creator_id", creatorId);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isFollowing = false;
  if (user && user.id !== creatorId) {
    const { data } = await supabase
      .from("creator_follows")
      .select("creator_id")
      .eq("creator_id", creatorId)
      .eq("follower_id", user.id)
      .maybeSingle();
    isFollowing = !!data;
  }

  return {
    count: count ?? 0,
    isFollowing,
    isSelf: !!user && user.id === creatorId,
    isAuthed: !!user,
  };
}

/** ホーム「フォロー中のクリエイター」strip 用カード。 */
export interface FollowingCreatorCard {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

/** 自分がフォロー中のクリエイター(新しい順)。未ログインは空。 */
export async function listFollowingCreators(
  limit = 18,
): Promise<FollowingCreatorCard[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: follows } = await supabase
    .from("creator_follows")
    .select("creator_id, created_at")
    .eq("follower_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  const ids = (follows ?? []).map((f) => f.creator_id as string);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("public_profiles")
    .select("id, display_name, avatar_path")
    .in("id", ids);

  // フォロー順(新しい順)を保つため、id 並びで並べ替え。
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({
      id: p.id,
      displayName: p.display_name ?? "",
      avatarUrl: publicAvatarUrl(p.avatar_path),
    }));
}
