"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session/require";
import { setUserPlanTester } from "@/lib/mutations/plan";
import type { UserPlan } from "@/lib/plan";

/**
 * テスター用: 課金なしでプランを切り替える Server Action(/pricing のボタン)。
 * 本人(requireUser)のプランのみ更新。Stripe Billing 実装後は Checkout/
 * Customer Portal への遷移に置き換える。
 */
export async function selectPlanTesterAction(
  plan: string,
): Promise<{ ok: true; plan: UserPlan } | { ok: false; error: string }> {
  const user = await requireUser();
  try {
    const next = await setUserPlanTester(user.id, plan);
    revalidatePath("/pricing");
    return { ok: true, plan: next };
  } catch (e) {
    console.error("[selectPlanTesterAction] failed", e);
    return { ok: false, error: "プランの変更に失敗しました" };
  }
}
