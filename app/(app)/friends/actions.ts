"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session/require";
import {
  ensureMyInviteToken,
  regenerateMyInviteToken,
  acceptFriendInvite,
  removeFriend,
  touchPresence,
} from "@/lib/mutations/friends";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 自分の招待トークンを取得(無ければ作成)。 */
export async function ensureInviteTokenAction(): Promise<string> {
  await requireUser();
  return ensureMyInviteToken();
}

/** 招待トークンを再発行(旧リンクは無効化)。 */
export async function regenerateInviteTokenAction(): Promise<string> {
  await requireUser();
  const token = await regenerateMyInviteToken();
  revalidatePath("/friends");
  return token;
}

/** 招待リンクを承認してフレンドになる。 */
export async function acceptInviteAction(
  token: string,
): Promise<{ ok: boolean }> {
  await requireUser();
  if (!UUID_RE.test(token)) return { ok: false };
  const inviter = await acceptFriendInvite(token);
  revalidatePath("/friends");
  return { ok: inviter !== null };
}

/** フレンド解除(フォーム: friendId)。 */
export async function removeFriendAction(formData: FormData): Promise<void> {
  await requireUser();
  const friendId = String(formData.get("friendId") ?? "");
  if (!UUID_RE.test(friendId)) return;
  await removeFriend(friendId);
  revalidatePath("/friends");
}

/**
 * 在席の心拍。クライアントが定期的に呼ぶ。未ログインなら RPC 側で no-op
 * になるため requireUser は通さない(リダイレクトを避ける)。
 */
export async function touchPresenceAction(): Promise<void> {
  await touchPresence();
}
