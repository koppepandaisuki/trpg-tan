import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { decideCheckoutOutcome } from "@/lib/stripe/webhook";

/**
 * Build a Stripe.Checkout.Session fake just rich enough for the decision
 * function. We cast through unknown — the SDK's Session type has many
 * fields we don't exercise here.
 *
 * Note: PR3 added `creatorId` / `applicationFeeJpy` to metadata. The
 * default fixture includes them so the happy-path test stays declarative;
 * dedicated tests override them to exercise the "missing → persist with
 * null" backward-compat path.
 */
function fakeSession(
  overrides: Partial<{
    id: string;
    payment_status: Stripe.Checkout.Session["payment_status"];
    mode: Stripe.Checkout.Session["mode"];
    amount_total: number | null;
    currency: string | null;
    metadata: Record<string, string> | null;
  }>,
): Stripe.Checkout.Session {
  return {
    id: "cs_test_default",
    payment_status: "paid",
    mode: "payment",
    amount_total: 1500,
    currency: "jpy",
    metadata: {
      productId: "p1",
      userId: "u1",
      creatorId: "c1",
      applicationFeeJpy: "450",
    },
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

const FIXED_NOW = new Date("2026-05-18T10:00:00.000Z");
const now = () => FIXED_NOW;

describe("decideCheckoutOutcome", () => {
  it("persists when all required fields are present (incl. PR3 metadata)", () => {
    const out = decideCheckoutOutcome(fakeSession({ id: "cs_test_ok" }), now);
    expect(out.type).toBe("persist");
    if (out.type !== "persist") return;
    expect(out.input).toEqual({
      userId: "u1",
      productId: "p1",
      stripeSessionId: "cs_test_ok",
      amountJpy: 1500,
      currency: "jpy",
      paidAt: FIXED_NOW,
      creatorId: "c1",
      applicationFeeJpy: 450,
    });
  });

  it("ignores when payment_status is not 'paid'", () => {
    const out = decideCheckoutOutcome(
      fakeSession({ payment_status: "unpaid" }),
      now,
    );
    expect(out).toEqual({ type: "ignore", reason: "payment_status_not_paid" });
  });

  it("ignores when mode is not 'payment'", () => {
    const out = decideCheckoutOutcome(
      fakeSession({ mode: "subscription" }),
      now,
    );
    expect(out).toEqual({ type: "ignore", reason: "unsupported_mode" });
  });

  it("ignores when productId is missing in metadata", () => {
    const out = decideCheckoutOutcome(
      fakeSession({ metadata: { userId: "u1" } }),
      now,
    );
    expect(out).toEqual({ type: "ignore", reason: "missing_metadata" });
  });

  it("ignores when userId is missing in metadata", () => {
    const out = decideCheckoutOutcome(
      fakeSession({ metadata: { productId: "p1" } }),
      now,
    );
    expect(out).toEqual({ type: "ignore", reason: "missing_metadata" });
  });

  it("ignores when metadata is null", () => {
    const out = decideCheckoutOutcome(fakeSession({ metadata: null }), now);
    expect(out).toEqual({ type: "ignore", reason: "missing_metadata" });
  });

  it("ignores when amount_total is missing", () => {
    const out = decideCheckoutOutcome(
      fakeSession({ amount_total: null }),
      now,
    );
    expect(out).toEqual({
      type: "ignore",
      reason: "missing_amount_or_currency",
    });
  });

  it("ignores when currency is missing", () => {
    const out = decideCheckoutOutcome(fakeSession({ currency: null }), now);
    expect(out).toEqual({
      type: "ignore",
      reason: "missing_amount_or_currency",
    });
  });

  it("uses the injected clock for paidAt", () => {
    const fixed = new Date("2030-01-01T00:00:00Z");
    const out = decideCheckoutOutcome(fakeSession({}), () => fixed);
    if (out.type !== "persist") throw new Error("expected persist");
    expect(out.input.paidAt).toBe(fixed);
  });

  // ===================================================================
  // D-020 PR3: backward-compat with sessions that lack creatorId /
  // applicationFeeJpy metadata (pre-PR3 webhooks or Stripe test events).
  // ===================================================================

  it("persists with creatorId=null when missing from metadata", () => {
    const out = decideCheckoutOutcome(
      fakeSession({
        metadata: { productId: "p1", userId: "u1", applicationFeeJpy: "450" },
      }),
      now,
    );
    if (out.type !== "persist") throw new Error("expected persist");
    expect(out.input.creatorId).toBeNull();
    expect(out.input.applicationFeeJpy).toBe(450);
  });

  it("persists with applicationFeeJpy=null when missing from metadata", () => {
    const out = decideCheckoutOutcome(
      fakeSession({
        metadata: { productId: "p1", userId: "u1", creatorId: "c1" },
      }),
      now,
    );
    if (out.type !== "persist") throw new Error("expected persist");
    expect(out.input.applicationFeeJpy).toBeNull();
    expect(out.input.creatorId).toBe("c1");
  });

  it("persists with applicationFeeJpy=null when metadata value is not numeric", () => {
    const out = decideCheckoutOutcome(
      fakeSession({
        metadata: {
          productId: "p1",
          userId: "u1",
          creatorId: "c1",
          applicationFeeJpy: "not-a-number",
        },
      }),
      now,
    );
    if (out.type !== "persist") throw new Error("expected persist");
    expect(out.input.applicationFeeJpy).toBeNull();
  });

  it("persists with applicationFeeJpy=null when metadata value is empty string", () => {
    const out = decideCheckoutOutcome(
      fakeSession({
        metadata: {
          productId: "p1",
          userId: "u1",
          creatorId: "c1",
          applicationFeeJpy: "",
        },
      }),
      now,
    );
    if (out.type !== "persist") throw new Error("expected persist");
    expect(out.input.applicationFeeJpy).toBeNull();
  });
});
