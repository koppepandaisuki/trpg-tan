import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAllowedCaller } from "@/lib/schedule/server";

/**
 * POST /api/schedule/friend-availability
 *
 * ログイン user の指定フレンドが、過去/未来の他の調整で yes/no/maybe を入れて
 * いる日付を集計する。フォーム上のスロット候補に「○ X 人 / × Y 人」を表示する
 * 「空き時間レコメンド」用。
 *
 * RPC `friend_date_availability` は呼び出し元のフレンド集合と交差して結果を返す
 * ので、無関係なユーザーの予定は混入しない(definer 側で防御)。
 */

const bodySchema = z.object({
  friendIds: z.array(z.string().uuid()).min(1).max(20),
  dates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"))
    .min(1)
    .max(60),
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

  const { data, error } = await supabase.rpc("friend_date_availability", {
    p_friend_ids: parsed.data.friendIds,
    p_dates: parsed.data.dates,
  });
  if (error) {
    console.error("[schedule/friend-availability] rpc failed", error);
    return NextResponse.json(
      { ok: false, message: "集計に失敗しました" },
      { status: 500 },
    );
  }

  const rows = ((data ?? []) as {
    date_iso: string;
    yes_count: number;
    no_count: number;
    maybe_count: number;
  }[]).map((r) => ({
    dateIso: r.date_iso,
    yes: r.yes_count ?? 0,
    no: r.no_count ?? 0,
    maybe: r.maybe_count ?? 0,
  }));

  return NextResponse.json(
    { ok: true, rows },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
