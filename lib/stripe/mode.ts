/**
 * Stripe Test/Live モード判定。
 *
 * STRIPE_SECRET_KEY のプレフィックスから判定する単純な純関数。
 * - sk_test_... → Test mode(true)
 * - sk_live_... → Live mode(false)
 * - 未設定 / その他 → Live(安全側、Test バナー等を出さない)
 *
 * 注意:この関数は server-only ガードを付けない。プレフィックスを引数で
 * 受け取る形にしてあるので、テストでは env 非依存に動かせる。
 * 呼び出し側はサーバーコンポーネントで `process.env.STRIPE_SECRET_KEY` を
 * 渡す前提。
 */

export function isStripeTestModeFromKey(secretKey: string | undefined): boolean {
  if (!secretKey) return false;
  return secretKey.startsWith("sk_test_");
}

/**
 * env から直接判定する shortcut。サーバーコンポーネントで使う。
 */
export function isStripeTestMode(): boolean {
  return isStripeTestModeFromKey(process.env.STRIPE_SECRET_KEY);
}
