import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * サーバ側レートリミット(乱用・総当たり・コスト攻撃の抑制)。
 *
 * check_rate_limit RPC(0044)を service_role で呼び、bucket ごとの固定ウィンドウ
 * カウンタで超過判定する。リミッタ自体が失敗したときは **fail-open**(許可)—
 * 可用性を優先し、DB 障害でアプリ全体を止めない。
 *
 * bucket は "<用途>:<識別子>" 形式。識別子は基本ユーザー ID(全て認証必須ルート)。
 */

export type RateRule = { limit: number; windowSeconds: number };

/** 用途別の既定リミット(1 ユーザーあたり)。 */
export const RATE_LIMITS = {
  /** リデームコード引き換え(総当たり抑止)。 */
  redeem: { limit: 10, windowSeconds: 60 },
  /** 運営 AI 呼び出し(Anthropic 実費のコスト攻撃抑止)。 */
  ai: { limit: 20, windowSeconds: 60 },
  /** スーパーサンクス送信(スパム抑止)。 */
  tips: { limit: 20, windowSeconds: 60 },
  /** 不具合報告 → Discord webhook(フラッド抑止)。 */
  feedback: { limit: 5, windowSeconds: 3600 },
  /** 作品のゴールド購入。 */
  purchaseGold: { limit: 30, windowSeconds: 60 },
  /** ゴールドパックの Checkout 作成。 */
  goldCheckout: { limit: 20, windowSeconds: 60 },
} as const satisfies Record<string, RateRule>;

/**
 * 直近ウィンドウ内の呼び出しが limit 以下なら true(許可)、超過なら false(拒否)。
 * DB エラー時は true を返す(fail-open)。
 */
export async function checkRateLimit(
  bucket: string,
  rule: RateRule,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });
    if (error) {
      console.warn("[rate-limit] check failed (fail-open)", error.message);
      return true;
    }
    return data === true;
  } catch (e) {
    console.warn("[rate-limit] unexpected error (fail-open)", e);
    return true;
  }
}

/** 429 応答(レート超過)。route 側でそのまま return する。 */
export function tooManyRequestsResponse(
  message = "リクエストが多すぎます。少し時間をおいてから再度お試しください",
): NextResponse {
  return NextResponse.json(
    { ok: false, reason: "rate_limited", message },
    { status: 429, headers: { "Cache-Control": "no-store" } },
  );
}
