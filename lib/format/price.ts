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
 * 割引後の実効価格(JPY 整数)。discountPercent は 0..100。
 *   salePriceJpy(1000, 30) -> 700
 *   salePriceJpy(500, 100) -> 0  (無料配布)
 * 端数は四捨五入。0 になったら無料(購入は無料DLフローに乗る)。
 *
 * 価格計算はサーバ(決済)と表示(クライアント)の両方で同じ結果が必要なため、
 * ここを唯一の真実とする(checkout も WorkCard も PriceTag もこれを使う)。
 */
export function salePriceJpy(priceJpy: number, discountPercent: number): number {
  const d = Math.min(100, Math.max(0, Math.round(discountPercent || 0)));
  if (d <= 0) return priceJpy;
  return Math.max(0, Math.round((priceJpy * (100 - d)) / 100));
}

/** 割引が実際に効いているか(率が 1 以上 かつ 定価が有料)。 */
export function hasDiscount(priceJpy: number, discountPercent: number): boolean {
  return priceJpy > 0 && discountPercent > 0;
}

/**
 * 割引の期間判定。startsAt / endsAt は ISO 文字列 or null。
 *   両方 null → 常に有効。starts のみ → その時刻以降。ends のみ → その時刻まで。
 * now はテスト用に差し替え可(既定は現在時刻)。
 */
export function isDiscountActive(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (startsAt) {
    const s = Date.parse(startsAt);
    if (!Number.isNaN(s) && now < s) return false;
  }
  if (endsAt) {
    const e = Date.parse(endsAt);
    if (!Number.isNaN(e) && now > e) return false;
  }
  return true;
}

/**
 * 「今」効いている実効割引率。率が 0 以下、または期間外なら 0(=定価)。
 * 価格表示・決済の両方でこの結果を salePriceJpy に渡す(唯一の真実)。
 */
export function effectiveDiscountPercent(
  discountPercent: number,
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now: number = Date.now(),
): number {
  const d = Math.min(100, Math.max(0, Math.round(discountPercent || 0)));
  if (d <= 0) return 0;
  return isDiscountActive(startsAt, endsAt, now) ? d : 0;
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
