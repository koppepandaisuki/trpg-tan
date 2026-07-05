import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * MFA(TOTP)の共通ヘルパー。Supabase Auth 標準の mfa API をラップする。
 *
 * 用途:
 *  - /admin/mfa/*: 管理者は必須(Stripe セキュリティチェックリスト対応)。
 *  - /account/settings: 一般ユーザーは任意で有効化できる。
 *
 * 呼び出し元(server action)は requireUser / requireAdmin を先に通すこと。
 * ここでは cookie ベースの session client(lib/supabase/server)を使うので、
 * enroll/verify は「現在ログイン中の本人」に対してのみ作用する。
 */

export type EnrollTotpResult =
  | { ok: true; factorId: string; qrCodeSvg: string; secret: string }
  | { ok: false; error: string };

export async function enrollTotpFactor(
  friendlyName?: string,
): Promise<EnrollTotpResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
  });
  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "設定を開始できませんでした",
    };
  }
  return {
    ok: true,
    factorId: data.id,
    qrCodeSvg: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export type VerifyTotpResult = { ok: true } | { ok: false; error: string };

/** enroll 直後の初回検証、または既存 factor への再認証(step-up)の両方に使う。 */
export async function verifyTotpFactor(
  factorId: string,
  code: string,
): Promise<VerifyTotpResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: code.trim(),
  });
  if (error) {
    return { ok: false, error: "認証コードが正しくありません" };
  }
  return { ok: true };
}

export type UnenrollTotpResult = { ok: true } | { ok: false; error: string };

export async function unenrollTotpFactor(
  factorId: string,
): Promise<UnenrollTotpResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return { ok: false, error: error.message || "解除に失敗しました" };
  }
  return { ok: true };
}

export type MfaFactorSummary = { id: string; friendlyName: string | null };

/** 検証済みの TOTP factor 一覧(未検証の途中状態は含めない)。 */
export async function listVerifiedTotpFactors(): Promise<MfaFactorSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return [];
  return data.totp
    .filter((f) => f.status === "verified")
    .map((f) => ({ id: f.id, friendlyName: f.friendly_name ?? null }));
}

/** 現在のセッションの認証レベル(aal2 = MFA 済み)。取得失敗時は null。 */
export async function getMfaAssuranceLevel(): Promise<
  "aal1" | "aal2" | null
> {
  const supabase = createClient();
  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return null;
  return (data.currentLevel as "aal1" | "aal2" | null) ?? null;
}
