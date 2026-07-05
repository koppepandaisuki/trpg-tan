import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { isSameOriginRequest } from "@/lib/api/origin";
import { createBearerClient } from "@/lib/supabase/bearer";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

async function resolveUser(
  request: NextRequest,
): Promise<{ id: string } | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    const {
      data: { user },
    } = await createBearerClient(token).auth.getUser();
    return user ? { id: user.id } : null;
  }
  if (!isSameOriginRequest(request)) return null;
  const u = await getCurrentUser();
  return u ? { id: u.id } : null;
}

/**
 * POST /api/plan/portal
 *
 * Stripe Customer Portal のセッションを作り URL を返す。プラン変更・解約・
 * 支払い方法の更新・領収書をユーザー自身が行える(自動課金の解約導線)。
 * Bearer JWT(デスクトップ)と Cookie セッション(ブラウザ)の両方を受け付ける。
 */
export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "ログインが必要です" },
      { status: 401 },
    );
  }

  let body: { returnTo?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // body は任意。失敗しても続行。
  }
  const isFromDesktop = body.returnTo === "desktop";

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  const customerId = data?.stripe_customer_id as string | null | undefined;
  if (!customerId) {
    return NextResponse.json(
      { ok: false, message: "有効なご契約が見つかりません" },
      { status: 400 },
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/pricing${isFromDesktop ? "?return_to=desktop" : ""}`,
    });
    return NextResponse.json(
      { ok: true, url: portal.url },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[plan/portal] failed", err);
    return NextResponse.json(
      { ok: false, message: "管理ページを開けませんでした" },
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
