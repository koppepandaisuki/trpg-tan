import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = ["/library", "/creator", "/admin"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Responsibilities (intentionally narrow):
 *   1. Refresh the Supabase session cookie on every request, including /api/*.
 *   2. For PAGE routes only: bounce unauthenticated visitors to /login.
 *   3. Expose the current pathname to RSC via x-pathname header
 *      so requireUser() can build a proper ?next= parameter.
 *
 * Why /api/* skips the redirect:
 *   API routes return JSON. Redirecting them to /login produces an HTML
 *   response that breaks fetch() callers. Each route handler is responsible
 *   for its own auth check and returns a proper 401 JSON when needed.
 *
 * Role checks (is_creator / is_admin) are NOT done here. Those happen
 * inside Server Components via requireCreator / requireAdmin so we don't
 * read profiles on every request.
 */
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);

  // Expose pathname to downstream RSC.
  response.headers.set("x-pathname", request.nextUrl.pathname);

  // API routes own their auth. Cookie was already refreshed above; nothing
  // else for middleware to do here.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return response;
  }

  if (!user && isProtected(request.nextUrl.pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    // Build a redirect response, then copy any cookies that updateSession
    // attached (refresh-token rotation, etc.). Without this, a token
    // refresh + redirect on the same request would lose the new cookies
    // and pin the user in a re-login loop on the next request.
    const redirectResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  // Run on everything except static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
