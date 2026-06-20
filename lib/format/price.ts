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

/**
 * ストアの価格絞り込みブラケット。?price=... で受け取り、products の
 * price_jpy 範囲で絞る。client/server 双方で使うため純データに保つ。
 */
export type StorePriceFilter = "free" | "u500" | "mid" | "o1000";

export const STORE_PRICE_FILTERS: { value: StorePriceFilter; label: string }[] = [
  { value: "free", label: "無料" },
  { value: "u500", label: "〜500円" },
  { value: "mid", label: "500〜1,000円" },
  { value: "o1000", label: "1,000円〜" },
];

export function parsePriceFilter(
  value: string | undefined,
): StorePriceFilter | null {
  return value === "free" ||
    value === "u500" ||
    value === "mid" ||
    value === "o1000"
    ? value
    : null;
}

export function priceFilterLabel(p: StorePriceFilter): string {
  return STORE_PRICE_FILTERS.find((f) => f.value === p)?.label ?? "";
}

/** price フィルタの円範囲。max=null は上限なし。 */
export function priceFilterRange(p: StorePriceFilter): {
  min: number;
  max: number | null;
} {
  switch (p) {
    case "free":
      return { min: 0, max: 0 };
    case "u500":
      return { min: 1, max: 500 };
    case "mid":
      return { min: 501, max: 1000 };
    case "o1000":
      return { min: 1001, max: null };
  }
}
