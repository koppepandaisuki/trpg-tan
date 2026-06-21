import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { manageSchema } from "@/lib/validators/schedule";
import { isAllowedCaller, zodFirstMessage } from "@/lib/schedule/server";

/**
 * POST /api/schedule/manage/[adminToken] — 主催の管理操作。
 * 管理トークンを知る者(= 主催)だけが、候補の確定 / メタ更新 / 削除を行える。
 *   - finalize: 確定枠を選ぶ(null で解除)。slot がこのイベントのものか検証。
 *   - update:   タイトル / メモ / 締切 を更新。
 *   - delete:   イベント削除(slots/votes/comments は cascade)。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { adminToken: string } },
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
  const parsed = manageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: zodFirstMessage(parsed.error) },
      { status: 400 },
    );
  }
  const op = parsed.data;

  const admin = createAdminClient();
  const { data: ev } = await admin
    .from("schedule_events")
    .select("id")
    .eq("admin_token", params.adminToken)
    .maybeSingle();
  if (!ev) {
    return NextResponse.json(
      { ok: false, message: "イベントが見つかりません" },
      { status: 404 },
    );
  }
  const eventId = ev.id as string;

  if (op.op === "delete") {
    const { error } = await admin
      .from("schedule_events")
      .delete()
      .eq("id", eventId);
    if (error) {
      console.error("[api/schedule/manage] delete failed", error);
      return NextResponse.json(
        { ok: false, message: "削除に失敗しました" },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (op.op === "finalize") {
    // 解除でなければ、その slot が本当にこのイベントのものか検証。
    if (op.slotId) {
      const { data: slot } = await admin
        .from("schedule_slots")
        .select("id")
        .eq("id", op.slotId)
        .eq("event_id", eventId)
        .maybeSingle();
      if (!slot) {
        return NextResponse.json(
          { ok: false, message: "その候補は存在しません" },
          { status: 400 },
        );
      }
    }
    const { error } = await admin
      .from("schedule_events")
      .update({ finalized_slot_id: op.slotId })
      .eq("id", eventId);
    if (error) {
      console.error("[api/schedule/manage] finalize failed", error);
      return NextResponse.json(
        { ok: false, message: "確定に失敗しました" },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  // op.op === "update"
  const patch: Record<string, unknown> = {};
  if (op.title !== undefined) patch.title = op.title;
  if (op.memo !== undefined) patch.memo = op.memo;
  if (op.deadline !== undefined) patch.deadline = op.deadline;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
  const { error } = await admin
    .from("schedule_events")
    .update(patch)
    .eq("id", eventId);
  if (error) {
    console.error("[api/schedule/manage] update failed", error);
    return NextResponse.json(
      { ok: false, message: "更新に失敗しました" },
      { status: 500 },
    );
  }
  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
