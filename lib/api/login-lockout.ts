import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ログインフォームのアカウントロック(Stripe セキュリティチェックリスト対応)。
 *
 * 「10 回以下のログイン失敗でアカウントをロックする」— メール単位で失敗回数を
 * 追跡し、閾値に達したら以降のログイン試行を Supabase Auth に渡す前に拒否する
 * (試行を渡さないことで Supabase 自身のレート制限も消費しない・タイミングで
 * アカウント存在の有無を推測されにくい)。
 *
 * 0044 の rate_limits テーブル/RPC をそのまま再利用する(専用テーブルを
 * 増やさない)。bucket は "login_fail:<正規化メール>"。
 */

const THRESHOLD = 10; // この回数の失敗で以降ロック
const WINDOW_SECONDS = 30 * 60; // 30 分の固定ウィンドウ

function bucketFor(email: string): string {
  return `login_fail:${email.trim().toLowerCase()}`;
}

/** 現在ロック中か(既に閾値以上の失敗があるか)。判定に失敗したら fail-open。 */
export async function isLoginLocked(email: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("rate_limit_peek", {
      p_bucket: bucketFor(email),
      p_window_seconds: WINDOW_SECONDS,
    });
    if (error) {
      console.warn("[login-lockout] peek failed (fail-open)", error.message);
      return false;
    }
    return typeof data === "number" && data >= THRESHOLD;
  } catch (e) {
    console.warn("[login-lockout] peek unexpected error (fail-open)", e);
    return false;
  }
}

/** ログイン失敗を 1 件記録する。 */
export async function recordLoginFailure(email: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc("check_rate_limit", {
      p_bucket: bucketFor(email),
      // limit は「戻り値の許可判定」のためだけの引数なのでここでは使わない
      // (isLoginLocked が閾値判定の実体)。THRESHOLD を渡して意味を揃える。
      p_limit: THRESHOLD,
      p_window_seconds: WINDOW_SECONDS,
    });
  } catch (e) {
    console.warn("[login-lockout] record failure error (non-fatal)", e);
  }
}

/** ログイン成功時に失敗カウントをリセットする。 */
export async function clearLoginLockout(email: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("rate_limits").delete().eq("bucket", bucketFor(email));
  } catch (e) {
    console.warn("[login-lockout] clear error (non-fatal)", e);
  }
}
