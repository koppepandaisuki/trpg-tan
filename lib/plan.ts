/**
 * 料金プラン(3 段階)の共通定義。
 *
 *   - basic : 無料。ストア閲覧 / 購入 / ライブラリ / キャラシ / レビュー。
 *   - play  : ¥500/月。PLAY(卓のホスト・全機能)を解放。
 *   - pro   : ¥980/月。play の全部 + 出品手数料の優遇(30%→20%)や
 *             日程調整の強化などクリエイター/上級者向け特典。
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

/** 出品手数料の優遇(Pro のみ)対象か。 */
export function planHasFeeDiscount(plan: string | null | undefined): boolean {
  return normalizePlan(plan) === "pro";
}
