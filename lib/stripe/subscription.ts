import "server-only";
import type Stripe from "stripe";
import { getStripe } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserPlan } from "@/lib/plan";

/**
 * 月額プラン(play/pro)の Stripe サブスクリプション課金ロジック。
 *
 * 付与/剥奪は webhook(customer.subscription.*) がここを通して profiles.plan を
 * 更新する。Price ID は Dashboard で作成し env で渡す(コードに焼かない)。
 *   STRIPE_PRICE_PLAY … プレイ ¥500/月 の Price ID
 *   STRIPE_PRICE_PRO  … Pro    ¥980/月 の Price ID
 */

/** サブスク対象の有料プラン。 */
export type PaidPlan = "play" | "pro";

/** env から Stripe Price ID を引く(未設定なら null = 未構成)。 */
export function priceIdForPlan(plan: PaidPlan): string | null {
  const id =
    plan === "play"
      ? process.env.STRIPE_PRICE_PLAY
      : process.env.STRIPE_PRICE_PRO;
  return id && id.trim().length > 0 ? id.trim() : null;
}

/** Price ID から plan を逆引き(未知なら null)。 */
export function planFromPriceId(
  priceId: string | null | undefined,
): PaidPlan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PLAY?.trim()) return "play";
  if (priceId === process.env.STRIPE_PRICE_PRO?.trim()) return "pro";
  return null;
}

/** プラン課金が構成済みか(両方の Price ID が env にある)。 */
export function isPlanBillingConfigured(): boolean {
  return Boolean(priceIdForPlan("play") && priceIdForPlan("pro"));
}

/**
 * ユーザーの Stripe Customer を取得 or 作成。profiles.stripe_customer_id に保存して
 * 再利用する(重複 Customer を作らない / webhook で stripe_customer_id 経由で
 * ユーザーを逆引きできるようにする)。
 */
export async function getOrCreateCustomerId(
  userId: string,
  email: string | null,
): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();
  const existing = data?.stripe_customer_id as string | null | undefined;
  if (existing) return existing;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    ...(email ? { email } : {}),
    metadata: { userId },
  });
  await admin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);
  return customer.id;
}

/** subscription.status のうち「有効(プラン付与)」とみなすもの。 */
function isActiveStatus(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing";
}

function customerIdOf(sub: Stripe.Subscription): string {
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}

/**
 * customer.subscription.created / updated を反映。
 * status が有効なら price から plan を付与、無効(支払い不能・解約済み等)なら
 * basic に落とす。stripe_customer_id 経由でユーザーを引く。
 */
export async function handleSubscriptionChange(
  sub: Stripe.Subscription,
): Promise<void> {
  const admin = createAdminClient();
  const customerId = customerIdOf(sub);

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (!profile) {
    console.warn("[subscription] no profile for customer", customerId);
    return;
  }

  const priceId = sub.items.data[0]?.price?.id ?? null;
  const plan = planFromPriceId(priceId);
  const active = isActiveStatus(sub.status);
  const nextPlan: UserPlan = active && plan ? plan : "basic";

  await admin
    .from("profiles")
    .update({
      plan: nextPlan,
      plan_sub_id: active ? sub.id : null,
      plan_status: sub.status,
      plan_current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
    })
    .eq("id", profile.id as string);
}

/** customer.subscription.deleted を反映(basic へダウングレード)。 */
export async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ plan: "basic", plan_sub_id: null, plan_status: "canceled" })
    .eq("stripe_customer_id", customerIdOf(sub));
}
