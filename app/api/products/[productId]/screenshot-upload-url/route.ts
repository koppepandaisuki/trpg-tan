import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { createClient } from "@/lib/supabase/server";
import {
  mimeToScreenshotExt,
  SCREENSHOTS_MAX_COUNT,
} from "@/lib/format/upload";
import { createScreenshotUploadUrl } from "@/lib/storage/signed-upload-url";
import { upsertProductScreenshot } from "@/lib/mutations/screenshots";
import { isSameOriginRequest } from "@/lib/api/origin";

/**
 * POST /api/products/[productId]/screenshot-upload-url
 *
 * 商品のスクリーンショット 1 枚アップロード用 signed URL を発行し、
 * 同時に product_screenshots に行を upsert する。
 *
 * 認証必須 + 自分の商品であること(creator_id = auth.uid())。
 *
 * Body shape:
 *   { "contentType": "image/png", "orderIndex": 0 }
 *
 * Response:
 *   200: { ok: true, url, path, expiresIn: 300 }
 *   400: missing / invalid content type / order out of range
 *   401: not authenticated
 *   403: cross-origin or not owner
 *   500: storage / db failure
 *
 * Path 形式: <creator_id>/<product_id>/<index>.<ext>
 */

const ADVERTISED_TTL = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: { productId: string } },
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

  let body: { contentType?: unknown; orderIndex?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "リクエストが不正です" },
      { status: 400 },
    );
  }

  const contentType =
    typeof body.contentType === "string" ? body.contentType : "";
  const orderIndex =
    typeof body.orderIndex === "number" ? Math.floor(body.orderIndex) : -1;

  if (!contentType) {
    return NextResponse.json(
      { ok: false, message: "Content-Type が指定されていません" },
      { status: 400 },
    );
  }
  if (orderIndex < 0 || orderIndex >= SCREENSHOTS_MAX_COUNT) {
    return NextResponse.json(
      {
        ok: false,
        message: `orderIndex は 0..${SCREENSHOTS_MAX_COUNT - 1} の範囲で指定してください`,
      },
      { status: 400 },
    );
  }

  const ext = mimeToScreenshotExt(contentType);
  if (!ext) {
    return NextResponse.json(
      {
        ok: false,
        message: "対応していない画像形式です(PNG / JPEG / WebP のみ)",
      },
      { status: 400 },
    );
  }

  // 自分の商品か検証
  const supabase = createClient();
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

  const path = `${user.id}/${params.productId}/${orderIndex}.${ext}`;

  // DB 行を先に upsert(失敗したら storage signed URL を取らない)
  try {
    await upsertProductScreenshot({
      productId: params.productId,
      orderIndex,
      path,
    });
  } catch (err) {
    console.error("[screenshot-upload-url] db upsert failed", err);
    return NextResponse.json(
      { ok: false, message: "アップロードを開始できませんでした" },
      { status: 500 },
    );
  }

  try {
    const url = await createScreenshotUploadUrl(path);
    return NextResponse.json(
      { ok: true, url, path, expiresIn: ADVERTISED_TTL },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (err) {
    console.error("[screenshot-upload-url] signed url failed", err);
    return NextResponse.json(
      { ok: false, message: "アップロードを開始できませんでした" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, message: "Method not allowed" },
    { status: 405 },
  );
}
