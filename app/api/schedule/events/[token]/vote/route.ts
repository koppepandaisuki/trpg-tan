import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { voteSchema } from "@/lib/validators/schedule";
import {
  isAllowedCaller,
  resolveOptionalUserId,
  zodFirstMessage,
} from "@/lib/schedule/server";

/**
 * POST /api/schedule/events/[token]/vote — 投票を upsert(信頼ベース)。
 *
 * voter_key で 1 人を束ね、(slot_id, voter_key) ごとに 1 行を置き換える。
 * URL を知る人なら誰でも書ける(調整さん型)。ログインしていれば user_id を裏で付与。
 * 他イベントの slot に書けないよう、slot がこのイベントに属することを必ず検証する。
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
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: zodFirstMessage(parsed.error) },
      { status: 400 },
    );
  }
  const input = parsed.data;

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
  const eventId = ev.id as string;

  // この slot が本当にこのイベントのものか検証(他イベントへの書き込み防止)。
  const { data: slotRows } = await admin
    .from("schedule_slots")
    .select("id")
    .eq("event_id", eventId);
  const validSlots = new Set((slotRows ?? []).map((r) => r.id as string));
  const entries = input.entries.filter((e) => validSlots.has(e.slotId));
  if (entries.length === 0) {
    return NextResponse.json(
      { ok: false, message: "対象の候補がありません" },
      { status: 400 },
    );
  }

  const userId = await resolveOptionalUserId(request);
  const rows = entries.map((e) => ({
    event_id: eventId,
    slot_id: e.slotId,
    voter_key: input.voterKey,
    voter_name: input.voterName,
    state: e.state,
    user_id: userId,
  }));
  const { error } = await admin
    .from("schedule_votes")
    .upsert(rows, { onConflict: "slot_id,voter_key" });
  if (error) {
    console.error("[api/schedule/vote] upsert failed", error);
    return NextResponse.json(
      { ok: false, message: "投票の保存に失敗しました" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
