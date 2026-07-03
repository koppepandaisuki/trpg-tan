import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { canPurchase } from "@/lib/access/purchase-access";
import { isSameOriginRequest } from "@/lib/api/origin";
import { getStripe } from "@/lib/stripe/client";
import { calculateApplicationFeeJpy } from "@/lib/stripe/fees";
import { createAdminClient } from "@/lib/supabase/admin";
import { salePriceJpy } from "@/lib/format/price";

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

  // Parse productId + optional returnTo (desktop deep-link).
  let body: { productId?: unknown; returnTo?: unknown } = {};
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
  // デスクトップから来た場合、success/cancel ページが redice:// で
  // アプリに戻れるよう return_to=desktop を URL に乗せる。
  const isFromDesktop = body.returnTo === "desktop";

  // Authorization
  const decision = await canPurchase(user.id, productId);
  if (!decision.ok) {
    return NextResponse.json(
      { ok: false, reason: decision.reason, message: decision.message },
      { status: decision.status },
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // 実際に請求する金額は割引後の実効価格。定価(priceJpy)は表示・記録用。
  // 割引 100% は実効 0 → 下の無料フローに落ちる(無料配布)。
  const effectivePriceJpy = salePriceJpy(
    decision.product.priceJpy,
    decision.product.discountPercent,
  );

  // Stripe の JPY 最低決済額は ¥50。1〜49 円は必ず Stripe 側で失敗するので、
  // 生のカードエラーではなく明確なメッセージで先に止める(validator でも同じ
  // 組合せを保存時に弾いているが、既存データ・期間開始による変動に備えた最終防衛)。
  if (effectivePriceJpy > 0 && effectivePriceJpy < 50) {
    console.warn("[checkout] below Stripe minimum", {
      productId: decision.product.id,
      effectivePriceJpy,
    });
    return NextResponse.json(
      {
        ok: false,
        message:
          "この作品は現在購入できません(割引後価格が決済可能な最低金額を下回っています)",
      },
      { status: 400 },
    );
  }

  // 無料(実効価格=0)、または管理者は Stripe を通さない:
  //   - 無料: Stripe の最低決済額(JPY ~50円)未満で必ず失敗する。
  //          クリエイターの Stripe Connect 未設定でも無料配布したい。
  //   - 管理者: 出品物のスクリーニング/動作確認のため Stripe 決済なしで
  //          ライブラリへ取り込めるようにする(運用配慮)。
  // admin client で purchases に paid 行を直接 insert し、success URL を
  // 返してその場で完了させる。stripe_session_id は UNIQUE 制約があるので
  // `free:{userId}:{productId}` 形式で再押下時の重複も防ぐ。
  const isAdminBypass = user.isAdmin;
  if (effectivePriceJpy <= 0 || isAdminBypass) {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    // session_id は集計時に区別したいので「admin:」「free:」プレフィックス。
    const prefix = isAdminBypass && effectivePriceJpy > 0 ? "admin" : "free";
    const { error: insErr } = await admin.from("purchases").insert({
      user_id: user.id,
      product_id: decision.product.id,
      stripe_session_id: `${prefix}:${user.id}:${decision.product.id}`,
      amount_jpy: 0,
      currency: "jpy",
      status: "paid",
      paid_at: now,
      creator_id: decision.product.creatorId,
      application_fee_jpy: 0,
    });
    if (insErr && insErr.code !== "23505") {
      // 23505 = unique_violation → 同時押下の race。実質「既に持ってる」と
      // 同じなので成功扱いにする。他のエラーは 500。
      console.error("[checkout/free] insert failed", insErr);
      return NextResponse.json(
        { ok: false, message: "受け取り処理に失敗しました" },
        { status: 500 },
      );
    }
    const successUrl = `${siteUrl}/checkout/success?free=1${isFromDesktop ? "&return_to=desktop" : ""}`;
    return NextResponse.json(
      { ok: true, url: successUrl },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Create Stripe Checkout Session
  const stripe = getStripe();

  // D-020 PR3: destination charge with platform fee.
  //   - application_fee_amount … プラットフォーム取り分(JPY 円整数)
  //   - transfer_data.destination … クリエイターの Connect account ID
  //   両方を payment_intent_data に渡すことで、Stripe 側で
  //   「決済 → 70% を creator へ即時 transfer、30% は platform 残」が成立する。
  //
  //   返金時は Stripe が自動で application_fee も逆算返金する
  //   (reverse transfer)。アプリ側で別途処理は不要。
  // クリエイターのプランで手数料率を出し分け(Pro は 30%→20% 優遇)。
  // RLS を跨いで他者の profiles.plan を読むため admin client を使う。
  const planAdmin = createAdminClient();
  const { data: creatorRow } = await planAdmin
    .from("profiles")
    .select("plan")
    .eq("id", decision.product.creatorId)
    .maybeSingle();
  const creatorPlan = creatorRow?.plan === "pro" ? "pro" : "basic";
  // 手数料も割引後の実効価格に対して計算する(請求額と整合させる)。
  const applicationFeeJpy = calculateApplicationFeeJpy(
    effectivePriceJpy,
    creatorPlan,
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
            unit_amount: effectivePriceJpy,
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
        // 実際に請求した金額(割引後)。purchases.amount_jpy の真実はこれ。
        priceJpy: String(effectivePriceJpy),
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
        // priceJpy>0 では canPurchase の creator_not_onboarded ガードを通って
        // いるので必ず非 null(型上は null 許容にしたため as で narrow)。
        transfer_data: {
          destination: decision.product.creatorStripeAccountId as string,
        },
        // Mirror productId/userId so refund-related events (Phase 8) can
        // resolve the purchase without joining through the checkout session.
        metadata: {
          productId: decision.product.id,
          userId: user.id,
        },
      },
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}${isFromDesktop ? "&return_to=desktop" : ""}`,
      cancel_url: `${siteUrl}/checkout/cancel?slug=${encodeURIComponent(decision.product.slug)}${isFromDesktop ? "&return_to=desktop" : ""}`,
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
