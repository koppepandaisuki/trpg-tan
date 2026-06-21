import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEventSchema } from "@/lib/validators/schedule";
import { newToken } from "@/lib/schedule/token";
import {
  isAllowedCaller,
  resolveOptionalUserId,
  zodFirstMessage,
} from "@/lib/schedule/server";

/**
 * POST /api/schedule/events — 日程調整イベントを作成する。
 *
 * 主催はアプリ(Bearer)/web(Cookie or 匿名)どちらからでも作成可。ログインしていれば
 * owner_user_id を裏で記録(「自分のイベント」用)。返り値の admin_token は主催だけが
 * 受け取る管理用トークン(以後の編集・確定・削除に必要)。
 */
export async function POST(request: NextRequest) {
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
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: zodFirstMessage(parsed.error) },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const ownerUserId = await resolveOptionalUserId(request);
  const admin = createAdminClient();
  const publicToken = newToken();
  const adminToken = newToken();

  const { data: ev, error } = await admin
    .from("schedule_events")
    .insert({
      public_token: publicToken,
      admin_token: adminToken,
      title: input.title,
      memo: input.memo ?? "",
      mode: input.mode,
      deadline: input.deadline ?? null,
      scenario_ref: input.scenarioRef ?? null,
      owner_user_id: ownerUserId,
    })
    .select("id")
    .single();
  if (error || !ev) {
    console.error("[api/schedule/events] insert event failed", error);
    return NextResponse.json(
      { ok: false, message: "作成に失敗しました" },
      { status: 500 },
    );
  }

  const slotRows = input.slots.map((s, i) => ({
    event_id: ev.id as string,
    starts_at: s.startsAt,
    label: s.label ?? "",
    sort: i,
  }));
  const { error: slotErr } = await admin
    .from("schedule_slots")
    .insert(slotRows);
  if (slotErr) {
    console.error("[api/schedule/events] insert slots failed", slotErr);
    // 候補が入らなければイベントだけ残っても無意味なので片付ける。
    await admin.from("schedule_events").delete().eq("id", ev.id);
    return NextResponse.json(
      { ok: false, message: "候補の保存に失敗しました" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, id: ev.id, publicToken, adminToken },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  return NextResponse.json(
    { ok: false, message: "Method not allowed" },
    { status: 405 },
  );
}
