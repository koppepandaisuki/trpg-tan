import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { decideAccountOutcome } from "@/lib/stripe/webhook";

/**
 * decideAccountOutcome unit tests.
 *
 * Same boundary-testing pattern as decideCheckoutOutcome / decideRefundOutcome:
 * the function is pure, so we exercise the decision boundary without
 * touching Supabase or Stripe APIs.
 */
function fakeAccount(
  overrides: Partial<{
    id: string;
    charges_enabled: boolean | null | undefined;
  }> = {},
): Stripe.Account {
  return {
    id: "acct_test_default",
    charges_enabled: true,
    ...overrides,
  } as unknown as Stripe.Account;
}

describe("decideAccountOutcome", () => {
  it("syncs when charges_enabled is true", () => {
    const out = decideAccountOutcome(fakeAccount({ id: "acct_ok" }));
    expect(out).toEqual({
      type: "sync",
      accountId: "acct_ok",
      chargesEnabled: true,
    });
  });

  it("syncs when charges_enabled is false (still propagates the new value)", () => {
    // We want the false → false / true → false transition to be reflected
    // in the DB. Don't filter "downgrades" at the decision layer.
    const out = decideAccountOutcome(
      fakeAccount({ id: "acct_pending", charges_enabled: false }),
    );
    expect(out).toEqual({
      type: "sync",
      accountId: "acct_pending",
      chargesEnabled: false,
    });
  });

  it("skips when account id is empty string", () => {
    const out = decideAccountOutcome(fakeAccount({ id: "" }));
    expect(out).toEqual({ type: "skip", reason: "missing_account_id" });
  });

  it("skips when charges_enabled is undefined", () => {
    const out = decideAccountOutcome(
      fakeAccount({ charges_enabled: undefined }),
    );
    expect(out).toEqual({ type: "skip", reason: "missing_charges_enabled" });
  });

  it("ignores other account fields (details_submitted, payouts_enabled, requirements)", () => {
    // PR3's publish gate is based on charges_enabled only. Make sure
    // unrelated fields do not flip the decision.
    const account = {
      id: "acct_with_extras",
      charges_enabled: true,
      details_submitted: false,
      payouts_enabled: false,
      requirements: { currently_due: ["external_account"] },
    } as unknown as Stripe.Account;

    const out = decideAccountOutcome(account);
    expect(out).toEqual({
      type: "sync",
      accountId: "acct_with_extras",
      chargesEnabled: true,
    });
  });
});
