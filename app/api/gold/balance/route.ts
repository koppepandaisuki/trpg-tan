import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/session/get-user";
import { isSameOriginRequest } from "@/lib/api/origin";
import { createBearerClient } from "@/lib/supabase/bearer";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/gold/balance — 残高 + 直近の取引履歴を返す。
 *
 * 200: { ok: true, balance, transactions: [{ amount, kind, note, createdAt }] }
 * profiles.gold_balance と gold_transactions は RLS で本人のみ読める。
 */

async function resolveClient(
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

export async function GET(request: NextRequest) {
  const auth = await resolveClient(request);
  if (!auth) {
    return NextResponse.json(
      { ok: false, message: "ログインが必要です" },
      { status: 401 },
    );
  }

  const [{ data: prof }, { data: tx }, { data: earn }] = await Promise.all([
    auth.client
      .from("profiles")
      .select("gold_balance")
      .eq("id", auth.userId)
      .maybeSingle(),
    auth.client
      .from("gold_transactions")
      .select("amount, kind, note, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    auth.client.rpc("gold_earnings"),
  ]);

  // RPC は 1 行(table 関数)。未適用(migration 0039 前)でも壊れないよう null 許容。
  const e = Array.isArray(earn) ? earn[0] : earn;

  return NextResponse.json(
    {
      ok: true,
      balance: prof?.gold_balance ?? 0,
      earnings: {
        sales: e?.total_sales ?? 0,
        tips: e?.total_tips ?? 0,
        supporters: e?.supporters ?? 0,
      },
      transactions: (tx ?? []).map((t) => ({
        amount: t.amount,
        kind: t.kind,
        note: t.note,
        createdAt: t.created_at,
      })),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST() {
  return NextResponse.json(
    { ok: false, message: "Method not allowed" },
    { status: 405 },
  );
}
