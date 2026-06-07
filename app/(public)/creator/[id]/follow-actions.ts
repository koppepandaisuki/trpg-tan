"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session/require";
import { followCreator, unfollowCreator } from "@/lib/mutations/creator-follow";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** クリエイターのフォロー/解除。 */
export async function setFollowAction(
  creatorId: string,
  follow: boolean,
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!UUID_RE.test(creatorId) || creatorId === user.id) {
    return { ok: false };
  }
  if (follow) await followCreator(creatorId);
  else await unfollowCreator(creatorId);
  revalidatePath(`/creator/${creatorId}`);
  return { ok: true };
}
