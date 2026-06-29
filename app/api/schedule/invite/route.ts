import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedCaller } from "@/lib/schedule/server";

/**
 * POST /api/schedule/invite — 日程調整イベントへのフレンド招待。
 *
 * 認証ありの user(オーナー)が、自分が作ったイベントの参加候補にフレンドを
 * 加える。サーバで以下を検証:
 *   1. ログインしていること
 *   2. adminToken が有効で、当該イベントの owner_user_id が呼び出し元と一致
 *   3. 招待先(targetIds)が呼び出し元のフレンドであること
 * 通った targetIds に対して send_schedule_invite RPC を呼ぶ。
 *
 * 通知 + schedule_invites の挿入は RPC が行う(SECURITY DEFINER + auth.uid())。
 */

const bodySchema = z.object({
  adminToken: z.string().min(1),
  friendIds: z.array(z.string().uuid()).min(1).max(20),
});

export async function POST(request: NextRequest) {
  if (!isAllowedCaller(request)) {
    return NextResponse.json(
      { ok: false, message: "リクエストが拒否されました" },
      { status: 403 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    body = null;
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "不正な入力" },
      { status: 400 },
    );
  }
  const { adminToken, friendIds } = parsed.data;

  // adminToken からイベントを引き、所有者一致を確認。
  const admin = createAdminClient();
  const { data: event } = await admin
    .from("schedule_events")
    .select("id, public_token, title, owner_user_id")
    .eq("admin_token", adminToken)
    .maybeSingle();
  if (!event) {
    return NextResponse.json(
      { ok: false, message: "イベントが見つかりません" },
      { status: 404 },
    );
  }
  if (event.owner_user_id !== user.id) {
    return NextResponse.json(
      { ok: false, message: "このイベントを招待できるのは作成者のみです" },
      { status: 403 },
    );
  }

  // フレンドが本当に呼び出し元のフレンドか確認(RPC 側でも見るが二重防御)。
  const eligible = new Set<string>();
  const { data: edges } = await admin
    .from("friendships")
    .select("user_low,user_high")
    .or(`user_low.eq.${user.id},user_high.eq.${user.id}`);
  (edges ?? []).forEach((e) => {
    const other = e.user_low === user.id ? e.user_high : e.user_low;
    eligible.add(other as string);
  });

  const accepted: string[] = [];
  const rejected: string[] = [];
  for (const id of friendIds) {
    if (!eligible.has(id)) {
      rejected.push(id);
      continue;
    }
    const { error } = await supabase.rpc("send_schedule_invite", {
      p_event_id: event.id,
      p_target: id,
      p_title: event.title,
      p_public_token: event.public_token,
    });
    if (error) {
      console.error("[schedule/invite] rpc failed", error);
      rejected.push(id);
    } else {
      accepted.push(id);
    }
  }

  return NextResponse.json(
    { ok: true, accepted, rejected },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
