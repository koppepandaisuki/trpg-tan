import "server-only";
import Stripe from "stripe";

/**
 * Stripe client — single source of truth.
 *
 * Why centralize here:
 *   - One apiVersion pin for the whole app, never drifts between routes.
 *   - One place to update the SDK in lockstep with the Dashboard.
 *   - Avoids `new Stripe(...)` being scattered across route handlers.
 *
 * The pinned API version should match the Dashboard's "Stripe API version"
 * setting. Update both together. See README for the rotation procedure.
 */

const STRIPE_API_VERSION = "2024-06-20" as const;

let cachedClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (cachedClient) return cachedClient;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    // Fail loudly. We never want a silent fallback to a real account.
    throw new Error(
      "[stripe] STRIPE_SECRET_KEY is not configured. Set it in .env.local.",
    );
  }

  cachedClient = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
    typescript: true,
    // Keep timeouts conservative; Stripe Hosted Checkout is fast.
    timeout: 20_000,
  });
  return cachedClient;
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "[stripe] STRIPE_WEBHOOK_SECRET is not configured. Webhook verification cannot proceed.",
    );
  }
  return secret;
}

/**
 * Connect webhook signing secret (D-020 PR2).
 *
 * Stripe Connect events for connected accounts (e.g. `account.updated`) are
 * delivered from a SEPARATE webhook endpoint configured as `connect: true`
 * in the Dashboard, which has its own signing secret. We point that endpoint
 * to the same URL (`/api/stripe/webhook`) and let the route handler try both
 * secrets during signature verification.
 *
 * Returns `null` (not throw) when unset so the route handler can fall back
 * to the primary secret only. This keeps the platform-only deployment path
 * working without forcing the Connect env var to be present.
 */
export function getConnectWebhookSecret(): string | null {
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  return secret && secret.length > 0 ? secret : null;
}
