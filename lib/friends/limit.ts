/**
 * フレンド数の上限(無料プラン)。正は DB の friend_limit()(migration 0051)で、
 * ここは画面の文言用。値を変えるときは両方そろえる。
 */
export const FREE_FRIEND_LIMIT = 30;

/** 上限に当たったのは自分か相手か(上限エラーでなければ null)。 */
export function friendLimitReason(
  err: { message?: string | null; details?: string | null } | null | undefined,
): "mine" | "theirs" | null {
  if (!err?.message?.includes("friend_limit_reached")) return null;
  return err.details === "theirs" ? "theirs" : "mine";
}

export function friendLimitMessage(reason: "mine" | "theirs"): string {
  return reason === "theirs"
    ? `相手のフレンドが上限(無料プランは ${FREE_FRIEND_LIMIT} 人)に達しているため、フレンドになれませんでした。`
    : `フレンドが上限(無料プランは ${FREE_FRIEND_LIMIT} 人)に達しています。プレイ・Pro プランなら無制限です。`;
}
