import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { isSameOriginRequest } from "@/lib/api/origin";
import { createBearerClient } from "@/lib/supabase/bearer";
import { getStripe } from "@/lib/stripe/client";
import { GOLD_PACKS, isGoldPackId } from "@/lib/gold";

/**
 * POST /api/gold/checkout — ゴールドパックの Stripe Checkout を作成。
 *
 * body: { pack: "p300" | "p1000" | "p3000", returnTo?: "desktop" }
 * 付与は webhook(checkout.session.completed, metadata.kind = "gold_pack")が
 * credit_gold RPC で行う(session id の一意制約で冪等)。
 */

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

export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "ログインが必要です" },
      { status: 401 },
    );
  }

  let body: { pack?: unknown; returnTo?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "リクエストが不正です" },
      { status: 400 },
    );
  }
  if (!isGoldPackId(body.pack)) {
    return NextResponse.json(
      { ok: false, message: "パックが不正です" },
      { status: 400 },
    );
  }
  const pack = GOLD_PACKS[body.pack];
  const isFromDesktop = body.returnTo === "desktop";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: pack.jpy,
            product_data: {
              name: `Re-dice ${pack.label}`,
              description:
                "アプリ内通貨(AI 利用 / 作品購入 / スーパーサンクス)。現金化はできません。",
            },
          },
        },
      ],
      metadata: {
        kind: "gold_pack",
        userId: user.id,
        gold: String(pack.gold),
      },
      success_url: `${siteUrl}/checkout/success?gold=${pack.gold}${isFromDesktop ? "&return_to=desktop" : ""}`,
      cancel_url: `${siteUrl}/pricing?gold_canceled=1${isFromDesktop ? "&return_to=desktop" : ""}`,
    });
    if (!session.url) {
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
    console.error("[gold/checkout] failed", err);
    return NextResponse.json(
      { ok: false, reason: "not_configured", message: "決済は準備中です" },
      { status: 400 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, message: "Method not allowed" },
    { status: 405 },
  );
}
