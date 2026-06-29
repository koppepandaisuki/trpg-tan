import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { isSameOriginRequest } from "@/lib/api/origin";
import { createBearerClient } from "@/lib/supabase/bearer";
import { getStripe } from "@/lib/stripe/client";
import {
  getOrCreateCustomerId,
  priceIdForPlan,
  isPlanBillingConfigured,
  type PaidPlan,
} from "@/lib/stripe/subscription";

// デスクトップ(Bearer JWT)とブラウザ(Cookie + Origin)の両経路を統一。
async function resolveUser(
  request: NextRequest,
): Promise<{ id: string; email: string | null } | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    const {
      data: { user },
    } = await createBearerClient(token).auth.getUser();
    return user ? { id: user.id, email: user.email ?? null } : null;
  }
  if (!isSameOriginRequest(request)) return null;
  const u = await getCurrentUser();
  return u ? { id: u.id, email: u.email ?? null } : null;
}

/**
 * POST /api/plan/checkout
 *
 * 月額プラン(play / pro)の Stripe サブスクリプション Checkout を作成し URL を返す。
 * クライアントはこの URL へ遷移する。デスクトップは外部ブラウザでこの導線(=/pricing)
 * を開き、決済後 return_to=desktop の deep-link でアプリに戻る。
 *
 * Bearer JWT(デスクトップ)と Cookie セッション(ブラウザ)の両方を受け付ける。
 * Trust boundary: クライアントは plan のみ渡す。Price は env の Price ID から
 * サーバ側で解決し、ユーザーには触らせない。
 */
export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "ログインが必要です" },
      { status: 401 },
    );
  }

  // 課金未構成(Price ID 未設定)のときは専用フラグを返す。UI はこれを見て
  // テスター用の切替にフォールバックできる(本番移行前を壊さない)。
  if (!isPlanBillingConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "not_configured", message: "課金は準備中です" },
      { status: 400 },
    );
  }

  let body: { plan?: unknown; returnTo?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "リクエストが不正です" },
      { status: 400 },
    );
  }
  const plan = body.plan === "pro" ? "pro" : body.plan === "play" ? "play" : null;
  if (!plan) {
    return NextResponse.json(
      { ok: false, message: "プランが不正です(play / pro)" },
      { status: 400 },
    );
  }
  const priceId = priceIdForPlan(plan as PaidPlan);
  if (!priceId) {
    return NextResponse.json(
      { ok: false, reason: "not_configured", message: "課金は準備中です" },
      { status: 400 },
    );
  }
  const isFromDesktop = body.returnTo === "desktop";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const stripe = getStripe();

  try {
    const customer = await getOrCreateCustomerId(user.id, user.email ?? null);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: user.id, plan },
      // webhook が subscription から userId を引けるよう冗長に持たせる。
      subscription_data: { metadata: { userId: user.id, plan } },
      success_url: `${siteUrl}/checkout/success?sub=${plan}${isFromDesktop ? "&return_to=desktop" : ""}`,
      cancel_url: `${siteUrl}/pricing?canceled=1${isFromDesktop ? "&return_to=desktop" : ""}`,
    });

    if (!session.url) {
      console.error("[plan/checkout] session without url", { id: session.id });
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
    console.error("[plan/checkout] failed", err);
    return NextResponse.json(
      { ok: false, message: "申し込み処理を開始できませんでした" },
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
