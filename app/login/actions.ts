"use server";

import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validators/auth";
import { safeNext } from "@/lib/api/redirect";
import {
  isLoginLocked,
  recordLoginFailure,
  clearLoginLockout,
} from "@/lib/api/login-lockout";

export type LoginActionResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

/**
 * Server-side login.
 *
 * Re-validates input with the same zod schema the client uses — never trust
 * the client-side check alone.
 *
 * IMPORTANT: We deliberately do NOT call `redirect()` here.
 *
 * When a Server Action is invoked imperatively from a Client Component
 * (handleSubmit → action), Next.js processes the response client-side via
 * a soft navigation. In that flow, the Set-Cookie headers written by
 * @supabase/ssr's adapter are not always applied to the browser's cookie
 * jar before the next request is made by the router, producing a login
 * loop where middleware sees no session right after a successful sign-in.
 *
 * Returning the target path and letting the client do
 * `window.location.href = redirectTo` forces a hard navigation, which is
 * the canonical workaround. See login-form.tsx.
 */
export async function loginAction(
  input: unknown,
  nextPath: string,
): Promise<LoginActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "入力内容を確認してください",
    };
  }

  // アカウントロック(Stripe セキュリティチェックリスト対応): 直近 30 分に
  // 10 回失敗していれば、Supabase Auth に渡す前に拒否する。
  if (await isLoginLocked(parsed.data.email)) {
    return {
      ok: false,
      error:
        "ログイン試行回数が上限に達しました。しばらく時間をおいてから再度お試しください。",
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    await recordLoginFailure(parsed.data.email);
    return {
      ok: false,
      error: "メールアドレスまたはパスワードが正しくありません",
    };
  }

  await clearLoginLockout(parsed.data.email);
  return { ok: true, redirectTo: safeNext(nextPath) };
}
