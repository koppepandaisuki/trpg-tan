import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/session/get-user";
import { isSameOriginRequest } from "@/lib/api/origin";
import { createBearerClient } from "@/lib/supabase/bearer";
import { createClient } from "@/lib/supabase/server";
import { goldErrorMessage } from "@/lib/gold";

/**
 * POST /api/purchase/gold — 作品をゴールドで購入する。
 *
 * body: { productId: string }
 * 実効価格(期間つき割引込み)の再計算・残高チェック・purchases 記録・
 * クリエイターへの付与(手数料差引後)は purchase_with_gold RPC が原子的に行う。
 *
 * 200: { ok: true, goldBalance }
 * 402: 残高不足 / 409: 購入済み / 400: 無料・自作 / 404: 見つからない
 */

async function resolveUserClient(
  request: NextRequest,
): Promise<{ userId: string; client: SupabaseClient } | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (bearer) {
    const client = createBearerClient(bearer);
    const {
      data: { user },
    } = await client.auth.getUser();
    return user ? { userId: user.id, client } : null;
  }
  if (!isSameOriginRequest(request)) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  return { userId: user.id, client: createClient() };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const auth = await resolveUserClient(request);
  if (!auth) {
    return NextResponse.json(
      { ok: false, message: "ログインが必要です" },
      { status: 401 },
    );
  }

  let body: { productId?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "リクエストが不正です" },
      { status: 400 },
    );
  }
  const productId =
    typeof body.productId === "string" && UUID_RE.test(body.productId)
      ? body.productId
      : null;
  if (!productId) {
    return NextResponse.json(
      { ok: false, message: "productId が不正です" },
      { status: 400 },
    );
  }

  const { data, error } = await auth.client.rpc("purchase_with_gold", {
    p_product: productId,
  });
  if (error) {
    const mapped = goldErrorMessage(error.message ?? "");
    return NextResponse.json(
      { ok: false, reason: mapped.reason, message: mapped.message },
      { status: mapped.status },
    );
  }

  return NextResponse.json(
    { ok: true, goldBalance: typeof data === "number" ? data : 0 },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  return NextResponse.json(
    { ok: false, message: "Method not allowed" },
    { status: 405 },
  );
}
