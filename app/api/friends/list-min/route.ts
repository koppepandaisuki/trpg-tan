import { NextResponse, type NextRequest } from "next/server";
import { listFriends } from "@/lib/queries/friends";
import { isSameOriginRequest } from "@/lib/api/origin";

// この GET は request 引数を読まず listFriends() 経由で cookies() を使うため、
// Next が静的レンダリングしようとして "Dynamic server usage" でビルドが落ちる。
// API は常に動的なので force-dynamic を明示する。
export const dynamic = "force-dynamic";

/**
 * GET /api/friends/list-min — ログイン user の最小フレンド一覧。
 * 日程調整の招待 UI のように "ログイン user 視点で自分のフレンドだけ" を
 * 取りたいシーンで使う。`listFriends()` を経由するため auth.uid が無い時は
 * 空配列を返す(エラー扱いしない)。
 */
export async function GET(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, message: "リクエストが拒否されました" },
      { status: 403 },
    );
  }
  try {
    const items = await listFriends();
    return NextResponse.json(
      {
        ok: true,
        friends: items.map((f) => ({
          id: f.id,
          displayName: f.displayName,
          avatarPath: f.avatarPath,
          online: f.online,
        })),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[/api/friends/list-min] failed", e);
    return NextResponse.json({ ok: true, friends: [] }, { status: 200 });
  }
}
