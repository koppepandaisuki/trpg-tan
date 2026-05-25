import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeInternalPath } from "@/lib/api/redirect";

/**
 * Supabase email-confirmation / OAuth callback.
 *
 * Supabase redirects here with ?code=... after the user clicks the
 * confirmation link. We exchange the code for a session and then
 * redirect into the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeInternalPath(searchParams.get("next"), "/library");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
