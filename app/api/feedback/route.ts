import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { isSameOriginRequest } from "@/lib/api/origin";
import { createBearerClient } from "@/lib/supabase/bearer";
import { feedbackInputSchema } from "@/lib/validators/feedback";
import { decideFeedbackOutcome } from "@/lib/feedback/discord";
import {
  checkRateLimit,
  RATE_LIMITS,
  tooManyRequestsResponse,
} from "@/lib/api/rate-limit";

/**
 * POST /api/feedback
 *
 * In-app feedback のサーバー受け口。α 期間中の収集インフラ。
 * デスクトップ(Bearer JWT)とブラウザ(Cookie + Origin)の両経路に対応
 * (他の desktop 向けルートと同じ resolveUser パターン)。
 *
 * 処理:
 *   1. 認証(Bearer or Cookie+Origin)
 *   2. レート制限
 *   3. 入力 validate(zod)
 *   4. Discord webhook へ payload を POST
 *
 * 戻り値:
 *   - 成功: 200 { ok: true, delivered: bool }
 *   - 入力エラー: 400 { ok: false, message }
 *   - 認証エラー: 401 { ok: false, message }
 *   - Discord 失敗: 502 { ok: false, message }
 *
 * webhook URL 未設定時は skip 扱いで 200 を返す(α 立ち上げ時の運用猶予)。
 */

export const runtime = "nodejs";

async function resolveUser(
  request: NextRequest,
): Promise<{ id: string; email: string; displayName: string } | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (bearer) {
    const client = createBearerClient(bearer);
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return null;
    const { data: profile } = await client
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    return {
      id: user.id,
      email: user.email ?? "",
      displayName: profile?.display_name ?? "",
    };
  }
  if (!isSameOriginRequest(request)) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  return { id: user.id, email: user.email, displayName: user.displayName };
}

export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "ログインが必要です" },
      { status: 401 },
    );
  }

  // Discord webhook フラッドの抑止(1 ユーザー 5 件/時)。
  if (!(await checkRateLimit(`feedback:${user.id}`, RATE_LIMITS.feedback))) {
    return tooManyRequestsResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "リクエストが不正です" },
      { status: 400 },
    );
  }

  const parsed = feedbackInputSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0]?.message ?? "入力を確認してください";
    return NextResponse.json(
      { ok: false, message: first },
      { status: 400 },
    );
  }

  const webhookUrl = process.env.DISCORD_FEEDBACK_WEBHOOK_URL ?? null;
  const outcome = decideFeedbackOutcome(
    parsed.data,
    {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      now: new Date(),
    },
    webhookUrl,
  );

  if (outcome.type === "skip") {
    console.info("[feedback] skip", { reason: outcome.reason });
    return NextResponse.json(
      { ok: true, delivered: false },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const res = await fetch(webhookUrl!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(outcome.payload),
    });
    if (!res.ok) {
      console.error("[feedback] discord webhook failed", {
        status: res.status,
        statusText: res.statusText,
      });
      return NextResponse.json(
        { ok: false, message: "送信に失敗しました。時間をおいて再度お試しください" },
        { status: 502 },
      );
    }
  } catch (err) {
    console.error("[feedback] fetch failed", err);
    return NextResponse.json(
      { ok: false, message: "送信に失敗しました。時間をおいて再度お試しください" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, delivered: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  return NextResponse.json(
    { ok: false, message: "Method not allowed" },
    { status: 405 },
  );
}
