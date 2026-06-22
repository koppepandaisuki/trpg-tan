import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { isSameOriginRequest } from "@/lib/api/origin";
import { getMyConnectStatus } from "@/lib/queries/creator-connect";
import { attachStripeAccountId } from "@/lib/mutations/creator-connect";
import {
  createConnectAccount,
  createOnboardingLink,
} from "@/lib/stripe/connect";

/**
 * POST /api/stripe/connect/onboarding-link
 *
 * D-020 PR2: creator が Stripe Express の onboarding 画面を開く起点。
 *
 * 処理:
 *   1. 認証 + creator 権限チェック
 *   2. profiles.stripe_account_id を読む
 *      - 未保有: stripe.accounts.create(Express, JP) → DB に保存
 *      - 保有  : 既存 account を再利用(二重作成しない)
 *   3. accountLinks.create で onboarding URL を発行して返す
 *
 * クライアントは返ってきた url で window.location.href リダイレクトする。
 * onboarding 完了後の DB 反映は `account.updated` webhook 経由
 * (本ルートでは行わない)。
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, message: "リクエストが拒否されました" },
      { status: 403 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "ログインが必要です" },
      { status: 401 },
    );
  }
  // 未 creator でも onboarding を開始できる(=「クリエイター申請」)。
  // Stripe Express の onboarding を完了し、charges_enabled=true が webhook
  // で同期されると初めて creator として認められる(syncCreatorChargesEnabled
  // 側で is_creator=true も同時にセットする運用)。

  const status = await getMyConnectStatus(user.id);
  let accountId = status.stripeAccountId;

  try {
    if (!accountId) {
      const account = await createConnectAccount(user.email);
      accountId = account.id;
      await attachStripeAccountId(user.id, accountId);
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const link = await createOnboardingLink({
      accountId,
      returnUrl: `${siteUrl}/creator/onboarding?status=return`,
      refreshUrl: `${siteUrl}/creator/onboarding?status=refresh`,
    });

    if (!link.url) {
      console.error("[connect] onboarding link missing url", {
        accountId,
      });
      return NextResponse.json(
        { ok: false, message: "オンボーディング URL を取得できませんでした" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: true, url: link.url },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[connect] onboarding-link failed", err);
    return NextResponse.json(
      { ok: false, message: "オンボーディングを開始できませんでした" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, message: "Method not allowed" },
    { status: 405 },
  );
}
