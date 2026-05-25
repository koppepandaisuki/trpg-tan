import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign out via POST (avoid CSRF surface of GET-triggered mutations).
 * The TopHeader renders a small <form method="post" action="/auth/sign-out">.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
