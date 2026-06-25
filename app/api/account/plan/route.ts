import { NextResponse, type NextRequest } from "next/server";
import { createBearerClient } from "@/lib/supabase/bearer";
import { setUserPlanTester } from "@/lib/mutations/plan";
import { normalizePlan } from "@/lib/plan";

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
    .select("plan")
    .eq("id", auth.user.id)
    .maybeSingle();
  return NextResponse.json(
    { ok: true, plan: normalizePlan(data?.plan) },
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
