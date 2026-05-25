import { describe, it, expect } from "vitest";
import { shortStripeId, stripeSessionDashboardUrl } from "@/lib/format/stripe";

describe("stripeSessionDashboardUrl", () => {
  it("returns null for nullish input", () => {
    expect(stripeSessionDashboardUrl(null)).toBeNull();
    expect(stripeSessionDashboardUrl(undefined)).toBeNull();
    expect(stripeSessionDashboardUrl("")).toBeNull();
  });

  it("routes cs_test_ ids to the test dashboard", () => {
    const url = stripeSessionDashboardUrl("cs_test_abc123");
    expect(url).toBe("https://dashboard.stripe.com/test/checkout/sessions/cs_test_abc123");
  });

  it("routes cs_live_ ids to the live dashboard", () => {
    const url = stripeSessionDashboardUrl("cs_live_abc123");
    expect(url).toBe("https://dashboard.stripe.com/checkout/sessions/cs_live_abc123");
  });

  it("treats unknown prefixes as live (safer default)", () => {
    const url = stripeSessionDashboardUrl("cs_other_abc");
    expect(url).toBe("https://dashboard.stripe.com/checkout/sessions/cs_other_abc");
  });
});

describe("shortStripeId", () => {
  it("returns empty for empty input", () => {
    expect(shortStripeId("")).toBe("");
  });

  it("returns the id unchanged when shorter than head", () => {
    expect(shortStripeId("cs_x", 12)).toBe("cs_x");
  });

  it("truncates long ids with an ellipsis", () => {
    const result = shortStripeId("cs_test_0123456789", 12);
    expect(result).toBe("cs_test_0123…");
  });

  it("uses default head of 12", () => {
    expect(shortStripeId("cs_test_0123456789")).toBe("cs_test_0123…");
  });
});
