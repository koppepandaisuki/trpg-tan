"use server";

import { requireAdmin } from "@/lib/session/require";
import {
  enrollTotpFactor,
  verifyTotpFactor,
  type EnrollTotpResult,
  type VerifyTotpResult,
} from "@/lib/mutations/mfa";

/**
 * 管理画面用の MFA server action。管理者は二段階認証が必須
 * (Stripe セキュリティチェックリスト対応、app/(app)/admin/layout.tsx が強制)。
 */

export async function adminEnrollMfaAction(): Promise<EnrollTotpResult> {
  await requireAdmin();
  return enrollTotpFactor("admin");
}

export async function adminVerifyMfaAction(input: {
  factorId: string;
  code: string;
}): Promise<VerifyTotpResult> {
  await requireAdmin();
  return verifyTotpFactor(input.factorId, input.code);
}
