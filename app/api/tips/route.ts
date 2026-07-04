import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/session/get-user";
import { isSameOriginRequest } from "@/lib/api/origin";
import { createBearerClient } from "@/lib/supabase/bearer";
import { createClient } from "@/lib/supabase/server";
import { goldErrorMessage } from "@/lib/gold";

/**
 * POST /api/tips — スーパーサンクス(クリエイターへゴールドを贈る)。
 *
 * body: { creatorId: string, amount: number, productId?: string, message?: string }
 * 移転は transfer_gold RPC が原子的に行う(自分宛て禁止・残高チェック込み)。
 * ゴールドは現金化できない(受け取ったクリエイターもアプリ内で使う)。
 *
 * 200: { ok: true, goldBalance }
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
const MESSAGE_MAX = 200;
const TIP_MAX = 100_000;

export async function POST(request: NextRequest) {
  const auth = await resolveUserClient(request);
  if (!auth) {
    return NextResponse.json(
      { ok: false, message: "ログインが必要です" },
      { status: 401 },
    );
  }

  let body: {
    creatorId?: unknown;
    amount?: unknown;
    productId?: unknown;
    message?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "リクエストが不正です" },
      { status: 400 },
    );
  }

  const creatorId =
    typeof body.creatorId === "string" && UUID_RE.test(body.creatorId)
      ? body.creatorId
      : null;
  const amount =
    typeof body.amount === "number" && Number.isInteger(body.amount)
      ? body.amount
      : NaN;
  if (!creatorId || !Number.isFinite(amount) || amount < 1 || amount > TIP_MAX) {
    return NextResponse.json(
      { ok: false, message: "送り先または金額が不正です(1〜100,000)" },
      { status: 400 },
    );
  }
  const productId =
    typeof body.productId === "string" && UUID_RE.test(body.productId)
      ? body.productId
      : null;
  const message =
    typeof body.message === "string"
      ? body.message.trim().slice(0, MESSAGE_MAX)
      : null;

  const { data, error } = await auth.client.rpc("transfer_gold", {
    p_to: creatorId,
    p_amount: amount,
    p_ref: productId,
    p_note: message || null,
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
