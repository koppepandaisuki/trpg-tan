import { describe, it, expect } from "vitest";
import {
  formatPrice,
  isFree,
  salePriceJpy,
  hasDiscount,
  isDiscountActive,
  effectiveDiscountPercent,
} from "@/lib/format/price";

describe("formatPrice", () => {
  it("returns 「無料」 for zero", () => {
    expect(formatPrice(0)).toBe("無料");
  });

  it("returns 「無料」 for negative values", () => {
    expect(formatPrice(-1)).toBe("無料");
  });

  it("formats positive JPY with 3-digit separators", () => {
    expect(formatPrice(1500)).toBe("¥1,500");
    expect(formatPrice(1000000)).toBe("¥1,000,000");
  });

  it("never shows fractional digits", () => {
    expect(formatPrice(1234)).toBe("¥1,234");
  });
});

describe("isFree", () => {
  it("treats 0 and negative as free", () => {
    expect(isFree(0)).toBe(true);
    expect(isFree(-1)).toBe(true);
  });

  it("treats positive prices as paid", () => {
    expect(isFree(1)).toBe(false);
    expect(isFree(100)).toBe(false);
  });
});

describe("salePriceJpy", () => {
  it("returns the list price when discount is 0", () => {
    expect(salePriceJpy(1000, 0)).toBe(1000);
    expect(salePriceJpy(0, 0)).toBe(0);
  });

  it("applies a percentage discount, rounding to the nearest yen", () => {
    expect(salePriceJpy(1000, 30)).toBe(700);
    expect(salePriceJpy(500, 33)).toBe(335); // 335 円(=500*0.67)
    expect(salePriceJpy(999, 10)).toBe(899); // 899.1 → 899
  });

  it("100% discount means free distribution (0 円)", () => {
    expect(salePriceJpy(500, 100)).toBe(0);
    expect(salePriceJpy(10000, 100)).toBe(0);
  });

  it("clamps out-of-range discount values", () => {
    expect(salePriceJpy(1000, -20)).toBe(1000);
    expect(salePriceJpy(1000, 150)).toBe(0);
  });
});

describe("hasDiscount", () => {
  it("is true only when a paid product has a positive discount", () => {
    expect(hasDiscount(1000, 30)).toBe(true);
    expect(hasDiscount(1000, 0)).toBe(false);
    expect(hasDiscount(0, 50)).toBe(false); // 無料作品に割引は無意味
  });
});

describe("isDiscountActive", () => {
  const now = Date.parse("2026-07-01T12:00:00Z");

  it("is always active when no period is set", () => {
    expect(isDiscountActive(null, null, now)).toBe(true);
  });

  it("respects the start boundary", () => {
    expect(isDiscountActive("2026-07-02T00:00:00Z", null, now)).toBe(false); // 未開始
    expect(isDiscountActive("2026-06-30T00:00:00Z", null, now)).toBe(true);
  });

  it("respects the end boundary", () => {
    expect(isDiscountActive(null, "2026-06-30T00:00:00Z", now)).toBe(false); // 終了済み
    expect(isDiscountActive(null, "2026-07-31T00:00:00Z", now)).toBe(true);
  });

  it("requires now to be within both bounds", () => {
    expect(
      isDiscountActive("2026-06-30T00:00:00Z", "2026-07-31T00:00:00Z", now),
    ).toBe(true);
  });
});

describe("effectiveDiscountPercent", () => {
  const now = Date.parse("2026-07-01T12:00:00Z");

  it("returns the rate inside the window, 0 outside", () => {
    expect(effectiveDiscountPercent(30, null, null, now)).toBe(30);
    expect(
      effectiveDiscountPercent(30, "2026-07-02T00:00:00Z", null, now),
    ).toBe(0); // まだ始まっていない
    expect(
      effectiveDiscountPercent(30, null, "2026-06-30T00:00:00Z", now),
    ).toBe(0); // 終了済み
  });

  it("returns 0 for non-positive rates regardless of window", () => {
    expect(effectiveDiscountPercent(0, null, null, now)).toBe(0);
  });
});
