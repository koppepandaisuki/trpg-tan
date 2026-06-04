import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/api/origin";
import { SCREENSHOTS_MAX_COUNT } from "@/lib/format/upload";

/**
 * DELETE /api/products/[productId]/screenshots/[orderIndex]
 *
 * 指定された orderIndex のスクリーンショットを削除する。
 *
 * 削除手順:
 *   1. 認証 + 同一オリジン + 商品の owner であることを検証
 *   2. orderIndex の範囲(0..3)を検証
 *   3. product_screenshots から該当行を取得して path を確認
 *   4. Storage から object 削除(失敗しても DB 行は消す → 孤児 object は
 *      将来的に cron で cleanup する想定。表示には影響しない)
 *   5. product_screenshots の DB 行を削除
 *
 * Response:
 *   200: { ok: true }
 *   400: invalid orderIndex
 *   401: not authenticated
 *   403: cross-origin / not owner
 *   404: screenshot not found(idempotent)
 *   500: DB failure
 */

const SCREENSHOTS_BUCKET = "screenshots";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { productId: string; orderIndex: string } },
) {
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

  const orderIndex = Number.parseInt(params.orderIndex, 10);
  if (
    !Number.isFinite(orderIndex) ||
    orderIndex < 0 ||
    orderIndex >= SCREENSHOTS_MAX_COUNT
  ) {
    return NextResponse.json(
      { ok: false, message: "無効な orderIndex です" },
      { status: 400 },
    );
  }

  const supabase = createClient();

  // owner 検証
  const { data: prod, error: prodErr } = await supabase
    .from("products")
    .select("id, creator_id")
    .eq("id", params.productId)
    .maybeSingle();
  if (prodErr || !prod) {
    return NextResponse.json(
      { ok: false, message: "商品が見つかりません" },
      { status: 404 },
    );
  }
  if (prod.creator_id !== user.id) {
    return NextResponse.json(
      { ok: false, message: "他のクリエイターの商品は編集できません" },
      { status: 403 },
    );
  }

  // 該当 screenshot 行を取得
  const { data: shot, error: shotErr } = await supabase
    .from("product_screenshots")
    .select("id, path")
    .eq("product_id", params.productId)
    .eq("order_index", orderIndex)
    .maybeSingle();
  if (shotErr) {
    console.error("[screenshot DELETE] select failed", shotErr);
    return NextResponse.json(
      { ok: false, message: "削除に失敗しました" },
      { status: 500 },
    );
  }
  // 既に無い → idempotent に 200 を返す(クライアント側の再試行に安全)
  if (!shot) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Storage object を削除(失敗しても DB は消す)
  try {
    const admin = createAdminClient();
    const { error: storageErr } = await admin.storage
      .from(SCREENSHOTS_BUCKET)
      .remove([shot.path]);
    if (storageErr) {
      // 孤児 object は将来 cron でクリーンアップする方針なのでログのみ
      console.error("[screenshot DELETE] storage remove failed", storageErr);
    }
  } catch (err) {
    console.error("[screenshot DELETE] storage remove threw", err);
  }

  // DB 行を削除
  const { error: delErr } = await supabase
    .from("product_screenshots")
    .delete()
    .eq("id", shot.id);
  if (delErr) {
    console.error("[screenshot DELETE] db delete failed", delErr);
    return NextResponse.json(
      { ok: false, message: "削除に失敗しました" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
