import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { canUploadProductFile } from "@/lib/access/upload-access";
import { updateProductFilePath } from "@/lib/mutations/product-paths";
import { createProductFileUploadUrl } from "@/lib/storage/signed-upload-url";
import { isSameOriginRequest } from "@/lib/api/origin";

/**
 * POST /api/products/[productId]/file-upload-url
 *
 * Issue a one-shot signed upload URL for the `product-files` (private)
 * bucket and atomically write the new path to `products.file_path`
 * (F-1, decisions Q7).
 *
 * Flow mirrors the cover-upload-url route, but the access layer also
 * checks that the supplied Content-Type matches the product's declared
 * `products.file_format` (decisions Q5 / Q8):
 *   - file_format='pdf'       → application/pdf
 *   - file_format='image_zip' → application/zip
 *   - file_format='audio'     → audio/mpeg or audio/wav
 *
 * Body shape:  { "contentType": "application/pdf" }
 */

const ADVERTISED_TTL = 300; // seconds — see signed-upload-url.ts TTL note

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

  let body: { contentType?: unknown } = {};
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
  if (!contentType) {
    return NextResponse.json(
      { ok: false, message: "Content-Type が指定されていません" },
      { status: 400 },
    );
  }

  const decision = await canUploadProductFile(
    user.id,
    params.productId,
    contentType,
  );
  if (!decision.ok) {
    return NextResponse.json(
      { ok: false, reason: decision.reason, message: decision.message },
      { status: decision.status },
    );
  }

  try {
    await updateProductFilePath(user.id, params.productId, decision.path);
  } catch (err) {
    console.error("[file-upload-url] db update failed", err);
    return NextResponse.json(
      { ok: false, message: "アップロードを開始できませんでした" },
      { status: 500 },
    );
  }

  try {
    const url = await createProductFileUploadUrl(decision.path);
    return NextResponse.json(
      { ok: true, url, path: decision.path, expiresIn: ADVERTISED_TTL },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (err) {
    console.error("[file-upload-url] signed url failed", err);
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
