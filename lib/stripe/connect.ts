import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";

/**
 * Stripe Connect (Express) thin wrappers.
 *
 * D-020 / PR2: creator が Stripe Express account を作成し、ホスト型
 * onboarding 画面に遷移するための最小ラッパ。副作用は Stripe API 呼び出しのみで、
 * DB 書き込みは呼び出し側(Route Handler)の責務に分離する。
 *
 * 国: JP 固定
 * Capabilities: card_payments + transfers(destination charge に必須)
 */

export async function createConnectAccount(
  email: string,
): Promise<Stripe.Account> {
  const stripe = getStripe();
  return stripe.accounts.create({
    type: "express",
    country: "JP",
    ...(email ? { email } : {}),
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
}

export async function createOnboardingLink(args: {
  accountId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<Stripe.AccountLink> {
  const stripe = getStripe();
  return stripe.accountLinks.create({
    account: args.accountId,
    return_url: args.returnUrl,
    refresh_url: args.refreshUrl,
    type: "account_onboarding",
  });
}
