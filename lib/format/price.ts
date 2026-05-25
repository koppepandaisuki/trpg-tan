const JPY = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

/**
 * Format a JPY price. 0 円 is rendered as "無料" by product convention.
 *
 * Node's ICU emits fullwidth "￥" (U+FFE5) on some platforms (notably
 * Windows + Node 20+) and halfwidth "¥" (U+00A5) on others. We normalize
 * to the halfwidth form for two reasons:
 *   - It is the convention in most Japanese software UI (Stripe, Apple Pay).
 *   - Test expectations become deterministic across environments.
 */
export function formatPrice(priceJpy: number): string {
  if (priceJpy <= 0) return "無料";
  return JPY.format(priceJpy).replace("￥", "¥");
}

export function isFree(priceJpy: number): boolean {
  return priceJpy <= 0;
}
