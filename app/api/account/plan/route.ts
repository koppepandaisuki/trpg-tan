import { NextResponse, type NextRequest } from "next/server";
import { createBearerClient } from "@/lib/supabase/bearer";
import { setUserPlanTester } from "@/lib/mutations/plan";
import { normalizePlan } from "@/lib/plan";
import { isAlphaAdminEmail } from "@/lib/access/alpha-whitelist";
import { isPlanBillingConfigured } from "@/lib/stripe/subscription";

/**
 * GET/POST /api/account/plan — デスクトップアプリ用の料金プラン取得/設定。
 *
 *   GET  : 現在のプランを返す。
 *   POST : テスター用に課金なしでプランを設定する({ plan } を受ける)。
 *
 * サーバアクションは外部から呼べないので Bearer JWT 経路を用意(/api/account/delete
 * と同方針)。本人の id のみ更新する。Stripe Billing 実装後は POST を webhook 付与に
 * 置き換える。
 */

async function bearerUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (!bearer) return null;
  const client = createBearerClient(bearer);
  const {
    data: { user },
  } = await client.auth.getUser();
  return user ? { user, client } : null;
}

export async function GET(request: NextRequest) {
  const auth = await bearerUser(request);
  if (!auth) {
    return NextResponse.json(
      { ok: false, message: "認証が必要です" },
      { status: 401 },
    );
  }
  const { data } = await auth.client
    .from("profiles")
    .select("plan, is_admin, is_tester")
    .eq("id", auth.user.id)
    .maybeSingle();
  // 管理者は profiles.is_admin、または α whitelist のメアド。管理者はプラン不問で
  // 全機能を使える(ゲート免除)ため、デスクトップへ admin フラグも返す。
  const admin =
    Boolean(data?.is_admin) || isAlphaAdminEmail(auth.user.email ?? "");
  // テスター権限(リデームコード「TESTER」で付与)。Stripe を介さずプラン切替可。
  const tester = Boolean(data?.is_tester);
  return NextResponse.json(
    { ok: true, plan: normalizePlan(data?.plan), admin, tester },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const auth = await bearerUser(request);
  if (!auth) {
    return NextResponse.json(
      { ok: false, message: "認証が必要です" },
      { status: 401 },
    );
  }
  // 本番課金(Stripe Price ID)が構成されたら、テスター切替は管理者 / テスター権限
  // 限定にする。これを怠ると「課金開始後も誰でも無料で pro にできる」API が残る。
  if (isPlanBillingConfigured()) {
    const { data: prof } = await auth.client
      .from("profiles")
      .select("is_admin, is_tester")
      .eq("id", auth.user.id)
      .maybeSingle();
    const admin =
      Boolean(prof?.is_admin) || isAlphaAdminEmail(auth.user.email ?? "");
    const tester = Boolean(prof?.is_tester);
    if (!admin && !tester) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "テスター用のプラン切替は終了しました。料金ページからお申し込みください",
        },
        { status: 403 },
      );
    }
  }
  let body: { plan?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "リクエストが不正です" },
      { status: 400 },
    );
  }
  const plan = typeof body.plan === "string" ? body.plan : "";
  try {
    const next = await setUserPlanTester(auth.user.id, plan);
    return NextResponse.json(
      { ok: true, plan: next },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[api/account/plan] set failed", e);
    return NextResponse.json(
      { ok: false, message: "プランの変更に失敗しました" },
      { status: 500 },
    );
  }
}
