import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Purchase mutations.
 *
 * Uses service_role because the purchases RLS forbids INSERT from any
 * client identity. The webhook handler is the only legitimate writer in
 * Phase 7.
 *
 * Idempotency strategy:
 *   - DB has UNIQUE (stripe_session_id).
 *   - We INSERT and treat the duplicate-key error as a no-op success.
 *   - Stripe retries the same event up to ~3 days; we want every retry to
 *     short-circuit cheaply.
 */

const PG_UNIQUE_VIOLATION = "23505";

export type UpsertPurchaseInput = {
  userId: string;
  productId: string;
  stripeSessionId: string;
  amountJpy: number;
  currency: string;
  paidAt: Date;
};

export async function upsertPurchaseFromSession(
  input: UpsertPurchaseInput,
): Promise<{ inserted: boolean }> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("purchases")
    .insert({
      user_id: input.userId,
      product_id: input.productId,
      stripe_session_id: input.stripeSessionId,
      amount_jpy: input.amountJpy,
      currency: input.currency,
      status: "paid",
      paid_at: input.paidAt.toISOString(),
    })
    .select("id")
    .single();

  if (!error && data) {
    return { inserted: true };
  }

  // Duplicate stripe_session_id — Stripe is retrying the same event.
  // Treat as success.
  if (error && (error.code === PG_UNIQUE_VIOLATION || /duplicate/i.test(error.message ?? ""))) {
    return { inserted: false };
  }

  throw new Error(
    `[upsertPurchaseFromSession] insert failed: ${error?.message ?? "unknown"}`,
  );
}

/**
 * Flip an existing `paid` purchase to `refunded`. Called by the
 * charge.refunded webhook handler after it has mapped the charge's
 * payment_intent to a Checkout Session ID.
 *
 * Idempotency:
 *   The `.eq("status", "paid")` filter means a re-delivered event finds
 *   nothing to update on the second pass. `updated: false` distinguishes
 *   "already refunded / never paid" from a fresh transition; the caller
 *   uses this only for logging.
 *
 * No row → not an error. This happens when the originating
 * checkout.session.completed never reached us (network drop etc.) and a
 * later refund fires against an unrecorded purchase. The webhook layer
 * surfaces a warn log; Stripe retries would not help, so we return
 * cleanly rather than throw.
 */
export async function markPurchaseRefunded(
  stripeSessionId: string,
  refundedAt: Date,
): Promise<{ updated: boolean }> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("purchases")
    .update({
      status: "refunded",
      refunded_at: refundedAt.toISOString(),
    })
    .eq("stripe_session_id", stripeSessionId)
    .eq("status", "paid")
    .select("id");

  if (error) {
    throw new Error(
      `[markPurchaseRefunded] update failed: ${error.message}`,
    );
  }

  return { updated: (data ?? []).length > 0 };
}
