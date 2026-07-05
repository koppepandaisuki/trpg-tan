import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import {
  upsertPurchaseFromSession,
  markPurchaseRefunded,
  type UpsertPurchaseInput,
} from "@/lib/mutations/purchases";
import { syncCreatorChargesEnabled } from "@/lib/mutations/creator-connect";
import { createAdminClient } from "@/lib/supabase/admin";
import { postOperatorAlert } from "@/lib/security/operator-alert";

/**
 * Webhook event handlers.
 *
 * Implemented:
 *   - checkout.session.completed              → write purchases row (paid)
 *   - checkout.session.async_payment_succeeded → same path (deferred payment)
 *   - charge.refunded                          → flip purchases.status to 'refunded'
 *   - account.updated                          → sync profiles.stripe_charges_enabled (D-020 PR2)
 *
 * Sibling refund events (`charge.refund.updated`, `refund.created`,
 * `refund.updated`) are intentionally NOT handled here — the canonical
 * "this charge is now fully refunded" signal is `charge.refunded`, and
 * registering the siblings would double-fire DB updates on the same
 * refund. The route layer acks them with a log.
 *
 * Anything else is silently 200'd at the route layer so Stripe does not
 * retry events we don't care about.
 */

// =====================================================================
// checkout.session.completed
// =====================================================================

export type CheckoutOutcome =
  | { type: "ignore"; reason: string }
  | { type: "persist"; input: UpsertPurchaseInput };

/**
 * Pure decision function for checkout.session.completed events.
 *
 * Extracted so it can be unit-tested without touching Supabase. The route
 * handler calls this, then either logs the reason or runs the upsert.
 *
 * `now` is injected for deterministic testing; defaults to the actual clock.
 */
export function decideCheckoutOutcome(
  session: Stripe.Checkout.Session,
  now: () => Date = () => new Date(),
): CheckoutOutcome {
  if (session.payment_status !== "paid") {
    return { type: "ignore", reason: "payment_status_not_paid" };
  }
  if (session.mode !== "payment") {
    return { type: "ignore", reason: "unsupported_mode" };
  }

  const productId = session.metadata?.productId;
  const userId = session.metadata?.userId;
  if (!productId || !userId) {
    return { type: "ignore", reason: "missing_metadata" };
  }

  if (!session.amount_total || !session.currency) {
    return { type: "ignore", reason: "missing_amount_or_currency" };
  }

  // D-020 PR3 metadata: creatorId / applicationFeeJpy のスナップショット。
  // pre-PR3 の session 再配信を許容するため、missing の場合は ignore せず
  // null を入れて persist する(列は nullable: PR1 設計)。
  // applicationFeeJpy は文字列で metadata に入っているため number へパース。
  // パース失敗時は null(payload 異常としてログだけ残し、本体は記録する)。
  const creatorId = session.metadata?.creatorId ?? null;
  const rawFee = session.metadata?.applicationFeeJpy;
  let applicationFeeJpy: number | null = null;
  if (rawFee != null && rawFee !== "") {
    const parsed = Number(rawFee);
    applicationFeeJpy = Number.isFinite(parsed) ? parsed : null;
  }

  return {
    type: "persist",
    input: {
      userId,
      productId,
      stripeSessionId: session.id,
      amountJpy: session.amount_total,
      currency: session.currency,
      paidAt: now(),
      applicationFeeJpy,
      creatorId,
    },
  };
}

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  // ゴールドパック購入は productId を持たず metadata.kind="gold_pack"。
  // credit_gold RPC が session id の一意制約で冪等に付与する。
  if (session.metadata?.kind === "gold_pack") {
    await handleGoldPackCompleted(session);
    return;
  }

  const outcome = decideCheckoutOutcome(session);

  if (outcome.type === "ignore") {
    console.info("[webhook] ignore", { id: session.id, reason: outcome.reason });
    return;
  }

  const { inserted } = await upsertPurchaseFromSession(outcome.input);
  console.info("[webhook] purchase recorded", {
    id: session.id,
    inserted,
    productId: outcome.input.productId,
  });
}

/**
 * ゴールドパック決済の付与。metadata の userId / gold を検証し、
 * credit_gold(service_role)で加算する。ref_id = session.id で二重付与を防ぐ。
 */
async function handleGoldPackCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.payment_status !== "paid") {
    console.info("[webhook] gold ignore", {
      id: session.id,
      reason: "payment_status_not_paid",
    });
    return;
  }
  const userId = session.metadata?.userId;
  const gold = Number(session.metadata?.gold);
  if (!userId || !Number.isFinite(gold) || gold <= 0) {
    console.warn("[webhook] gold ignore: bad metadata", { id: session.id });
    return;
  }
  const { data, error } = await createAdminClient().rpc("credit_gold", {
    p_user: userId,
    p_amount: Math.floor(gold),
    p_kind: "stripe_pack",
    p_ref: session.id,
    p_note: "ゴールドパック購入",
  });
  if (error) {
    throw new Error(`[webhook] gold credit failed: ${error.message}`);
  }
  console.info("[webhook] gold credited", {
    id: session.id,
    credited: data === true,
    gold,
  });
}

// =====================================================================
// charge.refunded
// =====================================================================

export type RefundOutcome =
  | { type: "persist"; paymentIntentId: string; refundedAt: Date }
  | { type: "skip"; reason: string };

/**
 * Pure decision function for `charge.refunded` events.
 *
 * MVP scope: only handle FULL refunds. Stripe sets `charge.refunded = true`
 * exclusively when the entire amount has been returned; partial refunds
 * leave `refunded = false` while `amount_refunded > 0`. Partial-refund
 * semantics for a digital good are ambiguous (the buyer still has the
 * file), so we skip those here. Operators who want to revoke access on a
 * partial refund can do so via admin product suspension.
 *
 * Exported so tests can pin the decision boundary without running Stripe
 * or DB calls (mirrors decideCheckoutOutcome's testing strategy).
 */
export function decideRefundOutcome(
  charge: Stripe.Charge,
  now: () => Date = () => new Date(),
): RefundOutcome {
  if (!charge.refunded) {
    return { type: "skip", reason: "not_fully_refunded" };
  }

  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);

  if (!paymentIntentId) {
    return { type: "skip", reason: "missing_payment_intent" };
  }

  return {
    type: "persist",
    paymentIntentId,
    refundedAt: now(),
  };
}

export async function handleChargeRefunded(
  charge: Stripe.Charge,
): Promise<void> {
  const outcome = decideRefundOutcome(charge);
  if (outcome.type === "skip") {
    console.info("[webhook] charge.refunded skip", {
      chargeId: charge.id,
      reason: outcome.reason,
    });
    return;
  }

  // The user-facing key on `purchases` is `stripe_session_id`, not the
  // PaymentIntent ID. We map charge → PaymentIntent → Checkout Session
  // via the Stripe API (one read per refund event; idempotent).
  const stripe = getStripe();
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: outcome.paymentIntentId,
    limit: 1,
  });
  const session = sessions.data[0];
  if (!session) {
    // Charge belongs to a payment we never recorded (e.g. a refund issued
    // to a session our checkout.session.completed webhook missed). Log
    // and move on — Stripe retries do not help; manual reconciliation
    // is the right path.
    console.warn("[webhook] charge.refunded: no session for payment_intent", {
      chargeId: charge.id,
      paymentIntentId: outcome.paymentIntentId,
    });
    return;
  }

  const { updated } = await markPurchaseRefunded(
    session.id,
    outcome.refundedAt,
  );
  console.info("[webhook] charge.refunded recorded", {
    chargeId: charge.id,
    sessionId: session.id,
    updated,
  });
}

// =====================================================================
// account.updated (Stripe Connect — D-020 PR2)
// =====================================================================

export type AccountOutcome =
  | { type: "sync"; accountId: string; chargesEnabled: boolean }
  | { type: "skip"; reason: string };

/**
 * Pure decision function for `account.updated` events.
 *
 * D-020 / PR2 のスコープでは「charges_enabled を profiles に同期する」だけが
 * 関心事。details_submitted / payouts_enabled / requirements は意図的に
 * 見ない:
 *   - PR3 で導入する publish ガードは charges_enabled だけを根拠にする
 *   - 他のフィールドを参照すると、Stripe 側の小さなステータス変化で
 *     毎回 DB が書き換わる(冪等性は保たれるが意味のないノイズが増える)
 *
 * 純関数として切り出しているのは、他のハンドラ(decideCheckoutOutcome /
 * decideRefundOutcome)と同じく Supabase に触らずに boundary をテストする
 * ため。
 */
export function decideAccountOutcome(
  account: Stripe.Account,
): AccountOutcome {
  if (!account.id) {
    return { type: "skip", reason: "missing_account_id" };
  }
  if (typeof account.charges_enabled !== "boolean") {
    return { type: "skip", reason: "missing_charges_enabled" };
  }
  return {
    type: "sync",
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
  };
}

export async function handleAccountUpdated(
  account: Stripe.Account,
): Promise<void> {
  const outcome = decideAccountOutcome(account);
  if (outcome.type === "skip") {
    console.info("[webhook] account.updated skip", {
      accountId: account.id,
      reason: outcome.reason,
    });
    return;
  }

  // 該当 profile が見つからない (当プラットフォーム経由ではない account)
  // 場合は updated:false が返る。warn ログだけ残し 200 で ack する
  // (Stripe リトライしても結果は変わらない)。
  const { updated } = await syncCreatorChargesEnabled(
    outcome.accountId,
    outcome.chargesEnabled,
  );

  if (!updated) {
    console.warn("[webhook] account.updated: no matching profile", {
      accountId: outcome.accountId,
    });
    return;
  }

  console.info("[webhook] account.updated synced", {
    accountId: outcome.accountId,
    chargesEnabled: outcome.chargesEnabled,
  });
}

// ---------------------------------------------------------------------
// charge.dispute.* (チャージバック)
//
// 実際の異議申し立て対応(証拠提出・返金判断)は Stripe ダッシュボードで行う
// (docs/stripe-operations.md 参照)。ここでは運営が即座に気づけるよう Discord に
// アラートを飛ばすだけ。ゴールドパックのチャージバックは閉じた経済なので被害は
// 限定的だが、作品購入(Connect 出金済み)のチャージバックは要対応。
// ---------------------------------------------------------------------

export type DisputeKind = "created" | "closed";

/** アラート本文を組み立てる純関数(Stripe 型に依存せずテスト可能)。 */
export function disputeAlertText(input: {
  kind: DisputeKind;
  id: string;
  amountJpy: number;
  reason: string;
  status: string;
  chargeId: string | null;
}): string {
  const head =
    input.kind === "created"
      ? "🚨 チャージバック発生(要対応)"
      : `📄 チャージバック確定: ${input.status}`;
  const lines = [
    head,
    `金額: ¥${input.amountJpy.toLocaleString()}`,
    `理由: ${input.reason}`,
    `状態: ${input.status}`,
    input.chargeId ? `charge: ${input.chargeId}` : null,
    `dispute: ${input.id}`,
    input.kind === "created"
      ? "→ Stripe ダッシュボードで異議内容を確認し、証拠提出 or 受諾を判断してください。"
      : null,
  ].filter((l): l is string => l !== null);
  return lines.join("\n");
}

function disputeInput(dispute: Stripe.Dispute, kind: DisputeKind) {
  const chargeId =
    typeof dispute.charge === "string"
      ? dispute.charge
      : (dispute.charge?.id ?? null);
  return {
    kind,
    id: dispute.id,
    // JPY は最小単位が円なので amount = 円。
    amountJpy: dispute.amount ?? 0,
    reason: dispute.reason ?? "unknown",
    status: dispute.status ?? "unknown",
    chargeId,
  };
}

export async function handleDisputeCreated(
  dispute: Stripe.Dispute,
): Promise<void> {
  console.warn("[webhook] charge.dispute.created", {
    disputeId: dispute.id,
    amount: dispute.amount,
    reason: dispute.reason,
  });
  await postOperatorAlert(disputeAlertText(disputeInput(dispute, "created")));
}

export async function handleDisputeClosed(
  dispute: Stripe.Dispute,
): Promise<void> {
  console.info("[webhook] charge.dispute.closed", {
    disputeId: dispute.id,
    status: dispute.status,
  });
  await postOperatorAlert(disputeAlertText(disputeInput(dispute, "closed")));
}
