import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Creator Stripe Connect mutations.
 *
 * Uses service_role because profiles has a BEFORE UPDATE trigger
 * (migration 0011) that blocks authenticated clients from writing
 * stripe_account_id / stripe_charges_enabled directly.
 *
 * Callers:
 *   - POST /api/stripe/connect/onboarding-link
 *       → attachStripeAccountId (after Stripe accounts.create)
 *   - webhook account.updated
 *       → syncCreatorChargesEnabled
 */

/**
 * 初回の onboarding 開始時に、生成したばかりの Stripe account ID を本人の
 * profile に書き込む。冪等性は呼び出し側で担保(既に値がある場合はそもそも
 * 呼ばない設計)。万一二重に呼ばれても同じ値で上書きされるだけ。
 */
export async function attachStripeAccountId(
  userId: string,
  stripeAccountId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ stripe_account_id: stripeAccountId })
    .eq("id", userId);

  if (error) {
    throw new Error(
      `[attachStripeAccountId] update failed: ${error.message}`,
    );
  }
}

/**
 * account.updated webhook で受け取った charges_enabled を反映する。
 *
 * stripe_account_id を主キー的に使うため、対応する profile が見つからない
 * (= 当プラットフォーム経由ではない account)場合は updated: false を返す。
 * 呼び出し側は warn ログにすれば足りる(throw しない方が retry を誘発しない)。
 */
export async function syncCreatorChargesEnabled(
  stripeAccountId: string,
  chargesEnabled: boolean,
): Promise<{ updated: boolean }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .update({ stripe_charges_enabled: chargesEnabled })
    .eq("stripe_account_id", stripeAccountId)
    .select("id");

  if (error) {
    throw new Error(
      `[syncCreatorChargesEnabled] update failed: ${error.message}`,
    );
  }

  return { updated: (data ?? []).length > 0 };
}
