import { NextResponse, type NextRequest } from "next/server";
import { runAnomalyReport } from "@/lib/security/anomaly";

/**
 * GET /api/cron/anomaly-check — 異常検知の日次ダイジェスト(Vercel Cron 用)。
 *
 * vercel.json の crons が毎日叩く。認証は CRON_SECRET(Vercel Cron が
 * Authorization: Bearer <CRON_SECRET> を自動付与)。
 *   - CRON_SECRET 未設定 → 503(開放エンドポイントにしない)。
 *   - Bearer 不一致 → 401。
 * 集計 → Discord 送信は runAnomalyReport が行う(webhook 未設定なら送信スキップ)。
 */

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, reason: "not_configured", message: "CRON_SECRET 未設定" },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const result = await runAnomalyReport(24);
  if (!result.ok) {
    console.error("[cron/anomaly-check] failed", result.message);
    return NextResponse.json({ ok: false, message: result.message }, { status: 500 });
  }
  return NextResponse.json(
    { ok: true, posted: result.posted, flags: result.flags },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
