/**
 * Build a URL to the Stripe Dashboard page for a given Checkout Session.
 *
 * Test/live is detected by the session id prefix:
 *   - cs_test_... → test mode dashboard
 *   - cs_live_... or anything else → live dashboard
 *
 * Returns null when the input is empty so the caller can hide the link.
 */
export function stripeSessionDashboardUrl(sessionId: string | null | undefined): string | null {
  if (!sessionId) return null;
  const isTest = sessionId.startsWith("cs_test_");
  const base = isTest
    ? "https://dashboard.stripe.com/test"
    : "https://dashboard.stripe.com";
  return `${base}/checkout/sessions/${sessionId}`;
}

/** Short display form of a long Stripe id. */
export function shortStripeId(id: string, head = 12): string {
  if (!id) return "";
  return id.length <= head ? id : `${id.slice(0, head)}…`;
}
