import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { canPurchase } from "@/lib/access/purchase-access";
import { isSameOriginRequest } from "@/lib/api/origin";
import { getStripe } from "@/lib/stripe/client";
import { calculateApplicationFeeJpy } from "@/lib/stripe/fees";

/**
 * POST /api/checkout
 *
 * Creates a Stripe Checkout Session for the given productId and returns
 * its hosted URL. Client redirects to the URL via window.location.href.
 *
 * Trust boundary: client provides ONLY productId. Price, title, currency,
 * etc. are re-fetched server-side from the products table.
 */
export async function POST(request: NextRequest) {
  // CSRF baseline
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, message: "リクエストが拒否されました" },
      { status: 403 },
    );
  }

  // Auth
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "ログインが必要です" },
      { status: 401 },
    );
  }

  // Parse productId
  let body: { productId?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "リクエストが不正です" },
      { status: 400 },
    );
  }
  const productId = typeof body.productId === "string" ? body.productId : "";
  if (!productId) {
    return NextResponse.json(
      { ok: false, message: "作品が指定されていません" },
      { status: 400 },
    );
  }

  // Authorization
  const decision = await canPurchase(user.id, productId);
  if (!decision.ok) {
    return NextResponse.json(
      { ok: false, reason: decision.reason, message: decision.message },
      { status: decision.status },
    );
  }

  // Create Stripe Checkout Session
  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // D-020 PR3: destination charge with platform fee.
  //   - application_fee_amount … プラットフォーム取り分(JPY 円整数)
  //   - transfer_data.destination … クリエイターの Connect account ID
  //   両方を payment_intent_data に渡すことで、Stripe 側で
  //   「決済 → 70% を creator へ即時 transfer、30% は platform 残」が成立する。
  //
  //   返金時は Stripe が自動で application_fee も逆算返金する
  //   (reverse transfer)。アプリ側で別途処理は不要。
  const applicationFeeJpy = calculateApplicationFeeJpy(
    decision.product.priceJpy,
  );

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      // Pre-fill the email so users don't retype it. Empty string is invalid
      // for Stripe, so guard.
      ...(user.email ? { customer_email: user.email } : {}),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: decision.product.priceJpy,
            product_data: {
              name: decision.product.title,
            },
          },
        },
      ],
      metadata: {
        productId: decision.product.id,
        userId: user.id,
        slug: decision.product.slug,
        priceJpy: String(decision.product.priceJpy),
        productType: decision.product.productType,
        // PR3: webhook が `purchases.creator_id` /
        // `purchases.application_fee_jpy` を取得する経路。session を
        // 直接読むより metadata 経由のほうが Stripe API 呼び出しを
        // 増やさずに済む。
        creatorId: decision.product.creatorId,
        applicationFeeJpy: String(applicationFeeJpy),
      },
      payment_intent_data: {
        application_fee_amount: applicationFeeJpy,
        transfer_data: {
          destination: decision.product.creatorStripeAccountId,
        },
        // Mirror productId/userId so refund-related events (Phase 8) can
        // resolve the purchase without joining through the checkout session.
        metadata: {
          productId: decision.product.id,
          userId: user.id,
        },
      },
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancel?slug=${encodeURIComponent(decision.product.slug)}`,
    });

    if (!session.url) {
      console.error("[checkout] session created without url", { id: session.id });
      return NextResponse.json(
        { ok: false, message: "Checkout URL を取得できませんでした" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: true, url: session.url },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[checkout] session.create failed", err);
    return NextResponse.json(
      { ok: false, message: "購入処理を開始できませんでした" },
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
