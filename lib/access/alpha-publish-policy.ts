/**
 * α 期間の publish 制約ポリシー。
 *
 * decisions.md D-020 PR3 で publishAction に「Stripe Connect 完了
 * (`stripe_charges_enabled = true`)が必須」のガードを入れたが、
 * 実 α テスターが Stripe Express の本人確認(写真 OCR)で詰まる
 * 事例が頻発したため、α 期間中だけ「無料商品(¥0)であれば
 * Connect 未完了でも公開可」とする回避策を導入する。
 *
 * 有料商品は引き続き Connect 必須(destination charge / 30% fee の
 * 整合性を維持する必要があるため)。
 *
 * env `ALPHA_ALLOW_FREE_WITHOUT_CONNECT=true` で有効化。
 * Phase 2 で creator 申請 UI / Connect onboarding UX 改善が入ったら
 * 関連コードごと撤去予定(P2 Backlog 登録)。
 *
 * 純関数。env を直接読まないテストで挙動を pin できる。
 */

export type PublishPrecondition = "connect_required" | "free_allowed";

/**
 * "true" にだけ反応する厳格パース。"1" / "yes" / "TRUE" は false 扱い。
 * 誤って enable してしまう事故を防ぐため。
 */
export function isAlphaAllowFreeWithoutConnectEnabled(
  envValue: string | undefined = process.env.ALPHA_ALLOW_FREE_WITHOUT_CONNECT,
): boolean {
  return envValue === "true";
}

/**
 * publish 試行時の前提条件を返す。
 *
 * - Connect 完了 → 何でも公開可
 * - Connect 未完了 + 価格 0 + ALPHA env 有効 → 公開可(無料商品のみ)
 * - Connect 未完了 + 価格 > 0 → 公開不可
 * - Connect 未完了 + 価格 0 + ALPHA env 無効 → 公開不可(既存挙動)
 */
export type PublishGateInput = {
  stripeChargesEnabled: boolean;
  priceJpy: number;
  alphaAllowFreeWithoutConnect: boolean;
};

export type PublishGateDecision =
  | { allowed: true; reason: "connect_completed" | "alpha_free_exception" }
  | {
      allowed: false;
      reason: "connect_required_for_paid" | "connect_required";
    };

export function decidePublishGate(input: PublishGateInput): PublishGateDecision {
  if (input.stripeChargesEnabled) {
    return { allowed: true, reason: "connect_completed" };
  }

  if (input.alphaAllowFreeWithoutConnect && input.priceJpy === 0) {
    return { allowed: true, reason: "alpha_free_exception" };
  }

  if (input.alphaAllowFreeWithoutConnect && input.priceJpy > 0) {
    // env 有効だが有料商品 → 「無料にするか Connect 完了するか」を促すべき
    return { allowed: false, reason: "connect_required_for_paid" };
  }

  return { allowed: false, reason: "connect_required" };
}
