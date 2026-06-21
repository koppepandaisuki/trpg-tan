import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { commentSchema } from "@/lib/validators/schedule";
import {
  isAllowedCaller,
  resolveOptionalUserId,
  zodFirstMessage,
} from "@/lib/schedule/server";

/**
 * POST /api/schedule/events/[token]/comment — コメントを追加(信頼ベース)。
 * ログインしていれば user_id を裏で付与。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!isAllowedCaller(request)) {
    return NextResponse.json(
      { ok: false, message: "リクエストが拒否されました" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: zodFirstMessage(parsed.error) },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: ev } = await admin
    .from("schedule_events")
    .select("id")
    .eq("public_token", params.token)
    .maybeSingle();
  if (!ev) {
    return NextResponse.json(
      { ok: false, message: "イベントが見つかりません" },
      { status: 404 },
    );
  }

  const userId = await resolveOptionalUserId(request);
  const { error } = await admin.from("schedule_comments").insert({
    event_id: ev.id as string,
    name: parsed.data.name,
    text: parsed.data.text,
    user_id: userId,
  });
  if (error) {
    console.error("[api/schedule/comment] insert failed", error);
    return NextResponse.json(
      { ok: false, message: "コメントの保存に失敗しました" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
