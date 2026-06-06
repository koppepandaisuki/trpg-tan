import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Bearer-token Supabase client for non-cookie callers (the desktop app).
 *
 * The desktop app authenticates with a Supabase access token instead of the
 * SSR session cookie. We attach that token as a global Authorization header so
 * that:
 *   - `auth.getUser(token)` validates the JWT against the Auth server, and
 *   - any RLS-guarded query issued through this client sees `auth.uid()`.
 *
 * No session persistence — this is created per request and thrown away.
 *
 * Security: this is the anon key + the caller's own token, so it has exactly
 * the caller's privileges (same as the cookie client). It is NOT service_role.
 */
export function createBearerClient(accessToken: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
