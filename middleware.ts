import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = ["/library", "/creator", "/admin"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** タイミング攻撃を避けるための定数時間比較(長さ違いは早期 false でよい)。 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * 管理画面(/admin/*)への Basic 認証ゲート。
 *
 * Stripe セキュリティチェックリスト「管理者のアクセス可能な IP アドレスを
 * 制限する。制限できない場合はベーシック認証等のアクセス制限を設ける」対応。
 * Vercel Hobby プランには IP アローリスト機能(Firewall)が無いため、
 * Basic 認証を採用する。
 *
 * ADMIN_BASIC_AUTH_USER / ADMIN_BASIC_AUTH_PASS が未設定の場合は素通し
 * (ローカル開発を壊さないため)。本番では必ず設定すること
 * (docs/stripe-security-checklist.md 参照)。
 */
function checkAdminBasicAuth(request: NextRequest): NextResponse | null {
  const expectedUser = process.env.ADMIN_BASIC_AUTH_USER;
  const expectedPass = process.env.ADMIN_BASIC_AUTH_PASS;
  if (!expectedUser || !expectedPass) return null;

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(":");
      if (sep !== -1) {
        const u = decoded.slice(0, sep);
        const p = decoded.slice(sep + 1);
        if (timingSafeEqual(u, expectedUser) && timingSafeEqual(p, expectedPass)) {
          return null;
        }
      }
    } catch {
      // 不正な base64 → 認証失敗として扱う(下の 401 へ)。
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin", charset="UTF-8"' },
  });
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
  if (isAdminPath(request.nextUrl.pathname)) {
    const challenge = checkAdminBasicAuth(request);
    if (challenge) return challenge;
  }

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
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
