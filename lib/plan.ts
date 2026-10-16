/**
 * 料金プラン(3 段階)の共通定義。
 *
 *   - basic : 無料。卓のホスト・参加(2026-10 から無料。hostRequiresPlan 参照)/
 *             ライブラリ / キャラシ。
 *   - play  : ¥500/月。広告なし・TURN 中継など快適さの特典(旧: 卓のホストを解放)。
 *   - pro   : ¥980/月。play の全部 + 日程調整の強化など上級者向け特典。
 *             (2026-09 のストア廃止で「出品手数料の優遇」は無くなった)
 *
 * 課金(Stripe Billing)は別実装。本ファイルは判定とラベルだけの純粋ロジックで、
 * server-only は付けない(クライアントからも参照可能)。
 */

export type UserPlan = "basic" | "play" | "pro";

export const PLAN_LABEL: Record<UserPlan, string> = {
  basic: "基本",
  play: "プレイ",
  pro: "Pro",
};

/** 月額(円)。0 = 無料。pricing ページ表示と将来の課金で参照。 */
export const PLAN_PRICE_JPY: Record<UserPlan, number> = {
  basic: 0,
  play: 500,
  pro: 980,
};

/** 不明な値を安全に basic へ丸める。 */
export function normalizePlan(plan: string | null | undefined): UserPlan {
  return plan === "pro" ? "pro" : plan === "play" ? "play" : "basic";
}

/** PLAY(卓のホスト・全機能)が解放されるプランか(play / pro)。 */
export function planUnlocksPlay(plan: string | null | undefined): boolean {
  const p = normalizePlan(plan);
  return p === "play" || p === "pro";
}


/**
 * 卓の TURN 中継(直結できない回線でも確実に繋がり、相手に IP アドレスを
 * 見せない)を使えるプランか。有料プランの特典。サーバー側で TURN の鍵が
 * 設定されているときだけ実際に有効になる(lib/play/ice.ts)。
 */
export function planIncludesTurnRelay(plan: string | null | undefined): boolean {
  const p = normalizePlan(plan);
  return p === "play" || p === "pro";
}

/**
 * 卓のホスト(参加コードの発行 = マルチ卓)に有料プランが要るか。
 *
 * 既定は「要らない」= 誰でも無料で卓を立てられる(ココフォリアと同じ無料の線)。
 * 卓の通信は GM ⇔ 参加者の P2P 直結が主で、サーバー費用がほぼ掛からないため。
 * 有料プランの価値は広告なし・TURN 中継(確実接続 / IP 非公開)・容量などに置く。
 * 方針を戻したいときは env PLAY_HOST_REQUIRES_PLAN=true(サーバー側で判定)。
 */
export function hostRequiresPlan(): boolean {
  return (
    typeof process !== "undefined" &&
    process.env?.PLAY_HOST_REQUIRES_PLAN === "true"
  );
}

/** 卓のホストができるか(管理者は常に可)。サーバー側で呼ぶこと。 */
export function canHostTable(
  plan: string | null | undefined,
  isAdmin = false,
): boolean {
  return isAdmin || !hostRequiresPlan() || planUnlocksPlay(plan);
}
