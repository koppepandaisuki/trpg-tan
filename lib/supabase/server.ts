import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Server-side Supabase client (RSC / Route Handler / Server Action).
 *
 * Uses the canonical @supabase/ssr v0.4+ `getAll`/`setAll` cookie adapter.
 * The older `get/set/remove` adapter is deprecated and can drop cookies
 * when the auth helpers set several at once.
 *
 * `setAll` may throw inside an RSC render (cookies are read-only there).
 * We swallow the error; middleware refreshes the session on every request,
 * so the next navigation picks up the new cookies regardless.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component render context — cookies are
            // read-only there. Safe to ignore: middleware.ts handles cookie
            // writes on each request.
          }
        },
      },
    },
  );
}
