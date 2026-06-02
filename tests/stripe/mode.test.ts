import { describe, it, expect } from "vitest";
import { isStripeTestModeFromKey } from "@/lib/stripe/mode";

describe("isStripeTestModeFromKey", () => {
  it("returns true for sk_test_ prefix", () => {
    // 短い fake 値 — GitHub secret scanning が誤検知しない長さに抑える
    expect(isStripeTestModeFromKey("sk_test_fake")).toBe(true);
  });

  it("returns false for sk_live_ prefix", () => {
    // 同上 — 実キーと誤認されないよう "fake" suffix で十分短く
    expect(isStripeTestModeFromKey("sk_live_fake")).toBe(false);
  });

  it("returns false for undefined (safe default, no banner)", () => {
    expect(isStripeTestModeFromKey(undefined)).toBe(false);
  });

  it("returns false for empty string (safe default)", () => {
    expect(isStripeTestModeFromKey("")).toBe(false);
  });

  it("returns false for keys without expected prefix (defensive)", () => {
    expect(isStripeTestModeFromKey("rk_test_1234")).toBe(false);
    expect(isStripeTestModeFromKey("test_1234")).toBe(false);
    expect(isStripeTestModeFromKey("SK_TEST_1234")).toBe(false);
  });

  it("returns true for restricted test keys that match sk_test_ prefix", () => {
    // Stripe restricted keys (rk_) are different prefix and return false.
    // But sk_test_... keys, even short ones, count as test.
    expect(isStripeTestModeFromKey("sk_test_short")).toBe(true);
  });
});
