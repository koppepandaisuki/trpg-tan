import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { decideRefundOutcome } from "@/lib/stripe/webhook";

/**
 * Builds a Stripe.Charge fake rich enough for decideRefundOutcome's
 * decision boundary. Cast through unknown — the SDK type has many fields
 * we don't exercise.
 */
function fakeCharge(
  overrides: Partial<{
    id: string;
    refunded: boolean;
    amount_refunded: number;
    amount: number;
    payment_intent:
      | string
      | { id: string }
      | null
      | Partial<Stripe.PaymentIntent>;
  }>,
): Stripe.Charge {
  return {
    id: "ch_test_default",
    refunded: true,
    amount: 1500,
    amount_refunded: 1500,
    payment_intent: "pi_test_default",
    ...overrides,
  } as unknown as Stripe.Charge;
}

const FIXED_NOW = new Date("2026-05-20T10:00:00.000Z");
const now = () => FIXED_NOW;

describe("decideRefundOutcome", () => {
  it("persists when fully refunded with a string payment_intent", () => {
    const out = decideRefundOutcome(fakeCharge({ id: "ch_full" }), now);
    expect(out).toEqual({
      type: "persist",
      paymentIntentId: "pi_test_default",
      refundedAt: FIXED_NOW,
    });
  });

  it("accepts payment_intent as an expanded object with id", () => {
    const out = decideRefundOutcome(
      fakeCharge({ payment_intent: { id: "pi_expanded" } }),
      now,
    );
    if (out.type !== "persist") {
      throw new Error("expected persist, got " + out.type);
    }
    expect(out.paymentIntentId).toBe("pi_expanded");
  });

  it("skips partial refund (refunded=false, amount_refunded>0)", () => {
    // Stripe semantics: charge.refunded only flips true on FULL refund.
    // For partial we leave the purchase row untouched.
    const out = decideRefundOutcome(
      fakeCharge({ refunded: false, amount_refunded: 500 }),
      now,
    );
    expect(out).toEqual({ type: "skip", reason: "not_fully_refunded" });
  });

  it("skips when nothing has been refunded yet", () => {
    const out = decideRefundOutcome(
      fakeCharge({ refunded: false, amount_refunded: 0 }),
      now,
    );
    expect(out).toEqual({ type: "skip", reason: "not_fully_refunded" });
  });

  it("skips when payment_intent is null", () => {
    const out = decideRefundOutcome(fakeCharge({ payment_intent: null }), now);
    expect(out).toEqual({ type: "skip", reason: "missing_payment_intent" });
  });

  it("skips when payment_intent is an expanded object without id", () => {
    const out = decideRefundOutcome(
      fakeCharge({ payment_intent: {} }),
      now,
    );
    expect(out).toEqual({ type: "skip", reason: "missing_payment_intent" });
  });

  it("uses the injected clock for refundedAt", () => {
    const fixed = new Date("2030-01-01T00:00:00.000Z");
    const out = decideRefundOutcome(fakeCharge({}), () => fixed);
    if (out.type !== "persist") {
      throw new Error("expected persist, got " + out.type);
    }
    expect(out.refundedAt).toBe(fixed);
  });

  it("treats refunded=true with empty string payment_intent as missing", () => {
    // Defensive: the SDK type permits string, but an empty string is not a
    // valid PaymentIntent ID.
    const out = decideRefundOutcome(
      fakeCharge({ payment_intent: "" }),
      now,
    );
    expect(out).toEqual({ type: "skip", reason: "missing_payment_intent" });
  });
});
