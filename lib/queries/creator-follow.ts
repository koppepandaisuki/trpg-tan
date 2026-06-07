import "server-only";
import { createClient } from "@/lib/supabase/server";

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
