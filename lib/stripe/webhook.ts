import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { postOperatorAlert } from "@/lib/security/operator-alert";

/**
 * Webhook event handlers.
 *
 * Implemented:
 *   - checkout.session.completed / async_payment_succeeded
 *       → ゴールドパック(metadata.kind="gold_pack")の付与のみ
 *   - charge.dispute.created / closed → 運営への Discord アラート
 *   - (月額プランの customer.subscription.* は lib/stripe/subscription.ts)
 *
 * 2026-09 のストア(作品売買)廃止で、以下は撤去した:
 *   - 作品購入の purchases 記録(checkout.session.completed)
 *   - 作品返金の purchases.status 反映(charge.refunded)
 *   - Stripe Connect の出品者アカウント同期(account.updated)
 * これらのイベントが届いても route 層で 200 を返して握りつぶす(Stripe の
 * 再送を止めるため)。
 */

// =====================================================================
// checkout.session.completed
// =====================================================================

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  // ゴールドパック購入は metadata.kind="gold_pack"。credit_gold RPC が
  // session id の一意制約で冪等に付与する。
  if (session.metadata?.kind === "gold_pack") {
    await handleGoldPackCompleted(session);
    return;
  }
  // 月額プランの Checkout(mode=subscription)は customer.subscription.* 側で
  // 反映する。作品購入はストア廃止で存在しないので、それ以外は記録だけ。
  console.info("[webhook] checkout ignore", {
    id: session.id,
    mode: session.mode,
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

// ---------------------------------------------------------------------
// charge.dispute.* (チャージバック)
//
// 実際の異議申し立て対応(証拠提出・返金判断)は Stripe ダッシュボードで行う
// (docs/stripe-operations.md 参照)。ここでは運営が即座に気づけるよう Discord に
// アラートを飛ばすだけ(対象はゴールドパックと月額プランの決済)。
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
