import { describe, it, expect } from "vitest";
import { formatPrice, isFree } from "@/lib/format/price";

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
