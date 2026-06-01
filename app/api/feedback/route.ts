import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { isSameOriginRequest } from "@/lib/api/origin";
import { feedbackInputSchema } from "@/lib/validators/feedback";
import { decideFeedbackOutcome } from "@/lib/feedback/discord";

/**
 * POST /api/feedback
 *
 * In-app feedback button のサーバー受け口。α 期間中の収集インフラ。
 *
 * 処理:
 *   1. same-origin チェック
 *   2. requireUser(ログイン必須、anon の bot 投稿を排除)
 *   3. 入力 validate(zod)
 *   4. user context をサーバー側で取り直し
 *   5. Discord webhook へ payload を POST
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

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, message: "リクエストが拒否されました" },
      { status: 403 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "ログインが必要です" },
      { status: 401 },
    );
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
