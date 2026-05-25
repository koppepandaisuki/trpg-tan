import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Middleware-side Supabase client.
 *
 * Responsibilities:
 *   - Read the session cookies from the incoming request.
 *   - Let supabase.auth.getUser() refresh tokens if needed; the refreshed
 *     cookies are pushed onto BOTH the incoming request (so downstream
 *     RSC sees them) and the outgoing response (so the browser stores them).
 *
 * IMPORTANT: This uses @supabase/ssr's `getAll`/`setAll` adapter. The older
 * `get/set/remove` adapter recreates the response per cookie and drops all
 * but the last set in a multi-cookie refresh, which causes random logout
 * loops.
 *
 * Per the @supabase/ssr template warning, do NOT add code between
 * `createServerClient` and `supabase.auth.getUser()`, otherwise refreshed
 * tokens can fail to attach to the response.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // 1. Make refreshed cookies visible to the rest of this request.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // 2. Rebuild the response from the now-updated request so that
          //    downstream Server Components see the refreshed cookies too.
          supabaseResponse = NextResponse.next({ request });
          // 3. Mirror the cookies onto the response so the browser stores them.
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touch the session so it validates / refreshes. Result is intentionally
  // forwarded to the caller; the caller decides what to do with it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, user };
}
