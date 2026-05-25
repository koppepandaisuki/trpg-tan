import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { canDownload } from "@/lib/access/library-access";
import { createProductFileSignedUrl } from "@/lib/storage/signed-url";
import { isSameOriginRequest } from "@/lib/api/origin";

/**
 * POST /api/library/[productId]/download
 *
 * Steps:
 *   1. Origin check (CSRF baseline).
 *   2. Auth check.
 *   3. canDownload(...) — covers ownership, status, file existence.
 *   4. Issue a short-lived signed URL.
 *
 * Response shape (per Phase 6 confirmation):
 *   success → { ok: true, url, expiresIn }
 *   failure → { ok: false, message }
 *
 * Failure reasons (not_purchased / suspended / no_file / not_found) are
 * NEVER surfaced to the client. They are logged for diagnostics only.
 * The client always sees a generic 403 with the same generic message.
 */

const GENERIC_FORBIDDEN = "現在この作品はダウンロードできません";

export async function POST(
  request: NextRequest,
  { params }: { params: { productId: string } },
) {
  // 1. CSRF baseline
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, message: "リクエストが拒否されました" },
      { status: 403 },
    );
  }

  // 2. Auth — note middleware also bounces unauthenticated visitors from
  //    /api/library/*, but we re-check here so direct API calls fail safely.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "ログインが必要です" },
      { status: 401 },
    );
  }

  // 3. Authorization (ownership / status / file existence)
  const decision = await canDownload(user.id, params.productId);
  if (!decision.ok) {
    console.warn("[download] denied", {
      userId: user.id,
      productId: params.productId,
      reason: decision.reason,
    });
    return NextResponse.json(
      { ok: false, message: GENERIC_FORBIDDEN },
      { status: 403 },
    );
  }

  // 4. Signed URL
  try {
    const url = await createProductFileSignedUrl(decision.filePath, 120);
    return NextResponse.json(
      { ok: true, url, expiresIn: 120 },
      {
        status: 200,
        // No-cache: the URL is short-lived and per-user.
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (err) {
    console.error("[download] signed url failed", err);
    return NextResponse.json(
      { ok: false, message: "ダウンロードを開始できませんでした" },
      { status: 500 },
    );
  }
}

// Explicit 405 for GET so we never accidentally support an unsafe verb.
export async function GET() {
  return NextResponse.json(
    { ok: false, message: "Method not allowed" },
    { status: 405 },
  );
}
