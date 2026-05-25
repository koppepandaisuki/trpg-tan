import "server-only";
import type { NextRequest } from "next/server";

/**
 * Minimal CSRF mitigation for state-changing route handlers.
 *
 * Phase 6 ships only an Origin check. We don't add a CSRF token yet because:
 *   - signed-URL issuance is the single protected operation in this phase
 *   - Cookies are SameSite=Lax (Supabase default) so cross-origin POSTs from
 *     malicious sites won't carry the session anyway
 *   - The signed URL itself is short-lived (120s)
 *
 * Keep the helper small and reusable so Phase 9 can swap in a stronger
 * scheme (double-submit cookie or Edge-signed token) without rewriting
 * every call site.
 *
 * Returns true when the request is acceptable; false otherwise. Caller is
 * responsible for issuing 403.
 */
export function isSameOriginRequest(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  // Read-only methods do not modify state; allow without check.
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;

  const origin = request.headers.get("origin");
  // For state-changing methods, browsers send Origin reliably. Missing
  // Origin from a state-changing request is suspicious.
  if (!origin) return false;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    // Misconfiguration — fail closed rather than open.
    console.warn("[isSameOriginRequest] NEXT_PUBLIC_SITE_URL is not set");
    return false;
  }

  try {
    return new URL(origin).origin === new URL(siteUrl).origin;
  } catch {
    return false;
  }
}
