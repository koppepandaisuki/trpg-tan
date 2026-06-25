import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePlan, type UserPlan } from "@/lib/plan";

/**
 * テスター用: 課金なしでユーザーの料金プランを設定する。
 *
 * クローズドテスト期間のみの導線。Stripe Billing(月額自動決済)を実装したら、
 * プラン付与は webhook 経由(subscription.created/updated)に置き換え、この
 * 直接更新は admin 限定にする。呼び出し元(server action / Bearer API)が
 * 「本人の id のみ」を渡すことで他人のプランは変更できない。
 */
export async function setUserPlanTester(
  userId: string,
  plan: string,
): Promise<UserPlan> {
  const next = normalizePlan(plan);
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ plan: next })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  return next;
}
