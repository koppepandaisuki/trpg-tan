import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/session/get-user";
import { canDownload } from "@/lib/access/library-access";
import { createProductFileSignedUrl } from "@/lib/storage/signed-url";
import { createBearerClient } from "@/lib/supabase/bearer";
import { isSameOriginRequest } from "@/lib/api/origin";

/**
 * POST /api/library/[productId]/download
 *
 * Two auth paths:
 *   A. Cookie (web): Origin (CSRF baseline) + SSR session cookie.
 *   B. Bearer (desktop app): `Authorization: Bearer <supabase access token>`.
 *      Token auth carries no ambient cookie credential, so it is not subject
 *      to CSRF — the Origin check is skipped. The token is validated against
 *      the Auth server and the same RLS-backed canDownload runs with it.
 *
 * Steps (both paths):
 *   1. Resolve + authenticate the user.
 *   2. canDownload(...) — covers ownership, status, file existence.
 *   3. Issue a short-lived signed URL.
 *
 * Response shape:
 *   success → { ok: true, url, expiresIn, ext }
 *   failure → { ok: false, message }
 *
 * Failure reasons (not_purchased / suspended / no_file / not_found) are
 * NEVER surfaced to the client. They are logged for diagnostics only.
 * The client always sees a generic 403 with the same generic message.
 */

const GENERIC_FORBIDDEN = "現在この作品はダウンロードできません";

/** Extract a lowercase file extension from a Storage key (no leading dot). */
function extOf(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "bin";
  return base.slice(dot + 1).toLowerCase();
}

/**
 * Resolve the caller. Returns the userId and the supabase client to run
 * canDownload with (token-authed for Bearer, undefined for the cookie path so
 * canDownload builds the SSR client itself), or a NextResponse to short-circuit.
 */
async function resolveCaller(
  request: NextRequest,
): Promise<
  { userId: string; client?: SupabaseClient } | { error: NextResponse }
> {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;

  // B. Bearer path (desktop app).
  if (bearer) {
    const client = createBearerClient(bearer);
    const {
      data: { user },
      error,
    } = await client.auth.getUser(bearer);
    if (error || !user) {
      return {
        error: NextResponse.json(
          { ok: false, message: "ログインが必要です" },
          { status: 401 },
        ),
      };
    }
    return { userId: user.id, client };
  }

  // A. Cookie path (web). CSRF baseline first, then the SSR session.
  if (!isSameOriginRequest(request)) {
    return {
      error: NextResponse.json(
        { ok: false, message: "リクエストが拒否されました" },
        { status: 403 },
      ),
    };
  }
  const user = await getCurrentUser();
  if (!user) {
    return {
      error: NextResponse.json(
        { ok: false, message: "ログインが必要です" },
        { status: 401 },
      ),
    };
  }
  return { userId: user.id };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { productId: string } },
) {
  // 1. Authenticate (cookie or Bearer).
  const caller = await resolveCaller(request);
  if ("error" in caller) return caller.error;

  // 2. Authorization (ownership / status / file existence).
  const decision = await canDownload(
    caller.userId,
    params.productId,
    caller.client,
  );
  if (!decision.ok) {
    console.warn("[download] denied", {
      userId: caller.userId,
      productId: params.productId,
      reason: decision.reason,
    });
    return NextResponse.json(
      { ok: false, message: GENERIC_FORBIDDEN },
      { status: 403 },
    );
  }

  // 3. Signed URL.
  try {
    const url = await createProductFileSignedUrl(decision.filePath, 120);
    return NextResponse.json(
      { ok: true, url, expiresIn: 120, ext: extOf(decision.filePath) },
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
