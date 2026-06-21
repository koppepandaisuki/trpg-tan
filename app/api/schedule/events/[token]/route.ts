import { NextResponse } from "next/server";
import { getEventByPublicToken } from "@/lib/queries/schedule";

/**
 * GET /api/schedule/events/[token] — 公開トークンでイベント全体を取得。
 * 投票・コメント反映後の再取得に使う(初期表示はサーバコンポーネントで行う)。
 * admin_token は payload に含めない。
 */
export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
) {
  const event = await getEventByPublicToken(params.token);
  if (!event) {
    return NextResponse.json(
      { ok: false, message: "イベントが見つかりません" },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { ok: true, event },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
