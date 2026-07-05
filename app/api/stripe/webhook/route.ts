import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import {
  getStripe,
  getWebhookSecret,
  getConnectWebhookSecret,
} from "@/lib/stripe/client";
import {
  handleCheckoutCompleted,
  handleChargeRefunded,
  handleAccountUpdated,
  handleDisputeCreated,
  handleDisputeClosed,
} from "@/lib/stripe/webhook";
import {
  handleSubscriptionChange,
  handleSubscriptionDeleted,
} from "@/lib/stripe/subscription";

/**
 * POST /api/stripe/webhook
 *
 * Stripe -> our backend. We verify the signature before doing anything,
 * dispatch to per-event handlers, and ack 200 to suppress retries on
 * events we don't care about.
 *
 * IMPORTANT:
 *   - Read the raw body via request.text(). Do NOT parse JSON before
 *     signature verification or constructEvent will reject it.
 *   - No auth here — the signature IS the auth.
 *   - Never log the body, headers, secrets, or PII in production.
 */

// Force Node.js runtime — Stripe SDK uses Node crypto for signature
// verification and is not Edge-compatible.
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  // D-020 PR2: this URL is registered as TWO endpoints in Stripe Dashboard
  // (one platform-events, one Connect). Each has its own signing secret.
  // Try the platform secret first (most traffic), then fall back to the
  // Connect secret if present. Reject only when neither verifies.
  let event: Stripe.Event;
  const stripe = getStripe();
  const secrets: string[] = [getWebhookSecret()];
  const connectSecret = getConnectWebhookSecret();
  if (connectSecret) secrets.push(connectSecret);

  let lastErrMessage = "unknown";
  let verified = false;
  // Cast to satisfy strict TS — we only use `event` after `verified` is true.
  event = null as unknown as Stripe.Event;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
      verified = true;
      break;
    } catch (err) {
      lastErrMessage = err instanceof Error ? err.message : "unknown";
    }
  }
  if (!verified) {
    // Do not log the body or signature — keep the footprint small.
    console.warn("[webhook] signature verification failed:", lastErrMessage);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "charge.refunded": {
        // Full refund only — partial refunds are intentionally ignored
        // (see decideRefundOutcome in lib/stripe/webhook.ts).
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(charge);
        break;
      }

      case "account.updated": {
        // D-020 PR2: sync profiles.stripe_charges_enabled.
        // No-op for accounts not in our DB (warn log + 200 ack).
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(account);
        break;
      }

      case "charge.dispute.created": {
        // チャージバック発生 → 運営に即時アラート(対応は Stripe DB で手動)。
        const dispute = event.data.object as Stripe.Dispute;
        await handleDisputeCreated(dispute);
        break;
      }

      case "charge.dispute.closed": {
        // チャージバック確定(勝ち/負け)→ 結果を運営に通知。
        const dispute = event.data.object as Stripe.Dispute;
        await handleDisputeClosed(dispute);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        // 月額プラン(play/pro)の付与/状態同期。status が有効なら付与、
        // 支払い不能・解約済みなら basic に落とす。
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(sub);
        break;
      }

      case "customer.subscription.deleted": {
        // 解約確定 → basic へダウングレード。
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub);
        break;
      }

      case "charge.refund.updated":
      case "refund.created":
      case "refund.updated": {
        // Sibling refund events: ack-only. The canonical "charge is now
        // fully refunded" signal we act on is charge.refunded; the
        // siblings would over-fire and double-handle if we treated them
        // as triggers too.
        console.info("[webhook] refund event acknowledged", {
          type: event.type,
          id: event.id,
        });
        break;
      }

      default:
        // Acknowledge unknown event types to prevent unnecessary retries.
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    // Return 500 so Stripe retries the same event.
    console.error("[webhook] handler failed", {
      type: event.type,
      id: event.id,
      err: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "method not allowed" }, { status: 405 });
}
