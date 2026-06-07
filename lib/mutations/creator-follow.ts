import "server-only";
import { createClient } from "@/lib/supabase/server";

/** クリエイターをフォロー。既にフォロー済(PK 競合)は成功扱い。 */
export async function followCreator(creatorId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  if (user.id === creatorId) return; // 自分はフォローしない

  const { error } = await supabase
    .from("creator_follows")
    .insert({ follower_id: user.id, creator_id: creatorId });
  if (error && error.code !== "23505") {
    throw new Error(`followCreator failed: ${error.message}`);
  }
}

/** フォロー解除。 */
export async function unfollowCreator(creatorId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase
    .from("creator_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("creator_id", creatorId);
  if (error) throw new Error(`unfollowCreator failed: ${error.message}`);
}
