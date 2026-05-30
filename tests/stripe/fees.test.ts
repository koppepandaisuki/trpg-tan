import { describe, it, expect } from "vitest";
import {
  PLATFORM_FEE_RATE,
  calculateApplicationFeeJpy,
} from "@/lib/stripe/fees";

/**
 * Platform fee math is small but security-relevant (over/under collection).
 * Tested as a pure boundary suite to lock the rate and the rounding mode.
 */
describe("PLATFORM_FEE_RATE", () => {
  it("is fixed at 30% (D-020)", () => {
    expect(PLATFORM_FEE_RATE).toBe(0.3);
  });
});

describe("calculateApplicationFeeJpy", () => {
  it.each([
    [100, 30],
    [500, 150],
    [1000, 300],
    [1500, 450],
    [10000, 3000],
  ])("rounds cleanly for price %i → fee %i", (price, expected) => {
    expect(calculateApplicationFeeJpy(price)).toBe(expected);
  });

  it("rounds half-up (199 → 60, not 59)", () => {
    // 199 * 0.30 = 59.7 → Math.round → 60
    expect(calculateApplicationFeeJpy(199)).toBe(60);
  });

  it("rounds half-up at exact .5 (5 → 2, JS banker rounding caveat)", () => {
    // 5 * 0.30 = 1.5 → Math.round → 2 (round-half-up, NOT banker's rounding)
    expect(calculateApplicationFeeJpy(5)).toBe(2);
  });

  it("returns 0 for free products", () => {
    expect(calculateApplicationFeeJpy(0)).toBe(0);
  });

  it("returns 0 for negative input (defensive — DB CHECK already forbids)", () => {
    expect(calculateApplicationFeeJpy(-100)).toBe(0);
  });

  it("returns 0 for NaN / non-finite (defensive)", () => {
    expect(calculateApplicationFeeJpy(Number.NaN)).toBe(0);
    expect(calculateApplicationFeeJpy(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
