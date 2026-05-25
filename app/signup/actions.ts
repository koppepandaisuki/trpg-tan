"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signupSchema } from "@/lib/validators/auth";

// Signup keeps the original "return error on failure, redirect on success"
// shape because it never establishes a session (email confirmation flow).
// The login loop bug only affects sign-in, not sign-up.
type SignupActionResult = { error: string } | undefined;

/**
 * Server-side signup.
 *
 * On success, Supabase sends a confirmation email. We redirect to
 * /signup/check-email regardless of whether the email already exists
 * (avoid revealing account enumeration).
 */
export async function signupAction(input: unknown): Promise<SignupActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "入力内容を確認してください" };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = createClient();

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: {
        display_name: parsed.data.displayName,
      },
    },
  });

  if (error) {
    return { error: "登録に失敗しました。時間をおいて再度お試しください" };
  }

  redirect("/signup/check-email");
}
