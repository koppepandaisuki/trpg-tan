"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session/require";
import { setUserPlanTester } from "@/lib/mutations/plan";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getOrCreateCustomerId,
  priceIdForPlan,
  isPlanBillingConfigured,
  type PaidPlan,
} from "@/lib/stripe/subscription";
import type { UserPlan } from "@/lib/plan";

/**
 * テスター用: 課金なしでプランを切り替える Server Action(/pricing のボタン)。
 * 本人(requireUser)のプランのみ更新。Stripe Billing 構成後は startCheckoutAction が優先。
 */
export async function selectPlanTesterAction(
  plan: string,
): Promise<{ ok: true; plan: UserPlan } | { ok: false; error: string }> {
  const user = await requireUser();
  // 本番課金が構成されたらテスター切替は管理者 / テスター権限限定
  // (無料で pro になれる穴を塞ぐ。テスター権限はリデームコード「TESTER」で付与)。
  if (isPlanBillingConfigured() && !user.isAdmin && !user.isTester) {
    return {
      ok: false,
      error: "テスター用のプラン切替は終了しました。上のボタンからお申し込みください",
    };
  }
  try {
    const next = await setUserPlanTester(user.id, plan);
    revalidatePath("/pricing");
    return { ok: true, plan: next };
  } catch (e) {
    console.error("[selectPlanTesterAction] failed", e);
    return { ok: false, error: "プランの変更に失敗しました" };
  }
}

/**
 * Stripe Checkout セッションを作成してリダイレクトする。
 * 課金未構成の場合のみ { ok: false, reason: "not_configured" } を返す
 * (それ以外は redirect() でクライアントを Stripe に遷移させる)。
 */
export async function startCheckoutAction(
  plan: "play" | "pro",
): Promise<{ ok: false; reason: string; error: string }> {
  if (!isPlanBillingConfigured()) {
    return { ok: false, reason: "not_configured", error: "課金は準備中です" };
  }
  const user = await requireUser();
  const priceId = priceIdForPlan(plan as PaidPlan);
  if (!priceId) {
    return { ok: false, reason: "not_configured", error: "課金は準備中です" };
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // redirect() は例外を投げて遷移を実現するため、try/catch の内側で呼ぶと
  // 自分の catch に食われて「失敗しました」になる。URL を受けて外で redirect する。
  let checkoutUrl: string;
  try {
    const customer = await getOrCreateCustomerId(user.id, user.email ?? null);
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: user.id, plan },
      subscription_data: { metadata: { userId: user.id, plan } },
      success_url: `${siteUrl}/checkout/success?sub=${plan}`,
      cancel_url: `${siteUrl}/pricing?canceled=1`,
    });
    if (!session.url) {
      return {
        ok: false,
        reason: "server_error",
        error: "Checkout URL を取得できませんでした",
      };
    }
    checkoutUrl = session.url;
  } catch (err) {
    console.error("[startCheckoutAction] failed", err);
    return { ok: false, reason: "server_error", error: "申し込み処理に失敗しました" };
  }
  redirect(checkoutUrl);
}

/**
 * Stripe Customer Portal セッションを作成してリダイレクトする。
 * 契約がない場合は { ok: false } を返す。
 */
export async function openPortalAction(): Promise<{
  ok: false;
  error: string;
}> {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  const customerId = data?.stripe_customer_id as string | null | undefined;
  if (!customerId) {
    return { ok: false, error: "有効なご契約が見つかりません" };
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // startCheckoutAction と同じ理由で redirect は try の外で行う。
  let portalUrl: string;
  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/pricing`,
    });
    portalUrl = portal.url;
  } catch (err) {
    console.error("[openPortalAction] failed", err);
    return { ok: false, error: "管理ページを開けませんでした" };
  }
  redirect(portalUrl);
}
