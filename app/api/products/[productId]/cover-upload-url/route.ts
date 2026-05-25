import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { canUploadCover } from "@/lib/access/upload-access";
import { updateProductCoverPath } from "@/lib/mutations/product-paths";
import { createCoverUploadUrl } from "@/lib/storage/signed-upload-url";
import { isSameOriginRequest } from "@/lib/api/origin";

/**
 * POST /api/products/[productId]/cover-upload-url
 *
 * Issue a one-shot signed upload URL for the `covers` bucket and atomically
 * write the new path to `products.cover_path` (F-1, decisions Q7).
 *
 * Flow (decisions Ph-γ):
 *   1. isSameOriginRequest()        → 403 JSON
 *   2. getCurrentUser()              → 401 JSON
 *   3. canUploadCover()              → 400 / 403 / 404 JSON (specific reason)
 *   4. updateProductCoverPath()      → 500 JSON on DB failure
 *   5. createCoverUploadUrl()        → 500 JSON on Storage failure
 *   6. 200 JSON { ok, url, path, expiresIn: 300 }
 *
 * Client is expected to PUT the file body to `url` within ~5 minutes. If
 * the PUT fails the user can re-request, get a fresh URL for the same
 * path, and the second attempt overwrites (upsert: true).
 *
 * Body shape:  { "contentType": "image/png" }
 *   - `filename` / `size` from the client are NOT consumed here; size is
 *     enforced by the Supabase bucket setting (decisions Q8 / H-4).
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

  const decision = await canUploadCover(
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
    await updateProductCoverPath(user.id, params.productId, decision.path);
  } catch (err) {
    console.error("[cover-upload-url] db update failed", err);
    return NextResponse.json(
      { ok: false, message: "アップロードを開始できませんでした" },
      { status: 500 },
    );
  }

  try {
    const url = await createCoverUploadUrl(decision.path);
    return NextResponse.json(
      { ok: true, url, path: decision.path, expiresIn: ADVERTISED_TTL },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (err) {
    console.error("[cover-upload-url] signed url failed", err);
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
