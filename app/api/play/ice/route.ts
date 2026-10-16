import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { createBearerClient } from "@/lib/supabase/bearer";
import { normalizePlan, planIncludesTurnRelay, type UserPlan } from "@/lib/plan";
import {
  PUBLIC_STUN,
  generateTurnServers,
  isTurnConfigured,
} from "@/lib/play/ice";
import { RATE_LIMITS, checkRateLimit } from "@/lib/api/rate-limit";

/**
 * GET /api/play/ice — 卓の P2P 直結に使う ICE サーバー一覧。
 *
 *   - 誰にでも: 公開 STUN(無料)。
 *   - 有料プラン + TURN 設定済み: Cloudflare TURN の短期資格情報も足す
 *     (直結できない回線でも確実・IP アドレスを相手に見せない中継が使える)。
 *
 * Web はクッキー、デスクトップは Bearer(access token)で本人を判定する。
 * 未ログインでも STUN は返す(参加者がログイン不要でも直結できるように)。
 */

export const dynamic = "force-dynamic";

async function resolvePlan(
  request: NextRequest,
): Promise<{ id: string; plan: UserPlan } | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const client = createBearerClient(authHeader.slice(7).trim());
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return null;
    const { data } = await client
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();
    return { id: user.id, plan: normalizePlan(data?.plan) };
  }
  const user = await getCurrentUser();
  return user ? { id: user.id, plan: user.plan } : null;
}

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  const stunOnly = { ok: true, iceServers: PUBLIC_STUN, turn: false };
  if (!isTurnConfigured()) return NextResponse.json(stunOnly, { headers });

  const who = await resolvePlan(request).catch(() => null);
  if (!who || !planIncludesTurnRelay(who.plan)) {
    return NextResponse.json(stunOnly, { headers });
  }
  // 資格情報の発行は Cloudflare の API を叩くので乱用を抑える。超過時も STUN は返す。
  if (!(await checkRateLimit(`play-ice:${who.id}`, RATE_LIMITS.playIce))) {
    return NextResponse.json(stunOnly, { headers });
  }
  const turn = await generateTurnServers();
  if (!turn) return NextResponse.json(stunOnly, { headers });
  return NextResponse.json(
    { ok: true, iceServers: [...PUBLIC_STUN, ...turn], turn: true },
    { headers },
  );
}
