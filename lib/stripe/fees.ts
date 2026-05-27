/**
 * Platform fee rate for Stripe Connect destination charges.
 *
 * D-020: プラットフォーム取り分 30% / クリエイター取り分 70% の固定レート。
 * 1 箇所に集約し、checkout / webhook / 監査ログのいずれも同じ値を参照する。
 *
 * 過去購入の分配額は購入時点のスナップショットを
 * `purchases.application_fee_jpy` に保存しているため(D-020 PR1)、
 * 将来この定数を変更しても過去レコードは影響を受けない。
 *
 * 注: `application_fee_amount` は Stripe に最小通貨単位(JPY は円)で渡す
 * 整数。半端な小数を切り捨てではなく **四捨五入**(Math.round)している:
 *   - 価格 100 円なら 30 円(プラットフォーム) / 70 円(クリエイター)
 *   - 価格 199 円なら 60 円(プラットフォーム) / 139 円(クリエイター)
 *     (199 * 0.30 = 59.7 → round 60、残り 139)
 *
 * pure function なのでブラウザ / サーバー両方から参照可能
 * (server-only ガードは付けない)。
 */

export const PLATFORM_FEE_RATE = 0.3 as const;

export function calculateApplicationFeeJpy(priceJpy: number): number {
  if (!Number.isFinite(priceJpy) || priceJpy <= 0) return 0;
  return Math.round(priceJpy * PLATFORM_FEE_RATE);
}
