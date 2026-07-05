"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validators/auth";

/**
 * パスワードリセットメールの送信。
 *
 * Supabase の resetPasswordForEmail を呼ぶ。メール内のリンクは
 * Supabase Dashboard の Auth > Email Templates > "Reset Password" の
 * `{{ .ConfirmationURL }}` に reset リンクが入る。
 *
 * redirectTo を /auth/callback?next=/reset-password に向けることで、
 * クリック → callback で session 確立 → /reset-password に着地、という
 * 流れになる。/reset-password 側で updateUser({ password }) を呼ぶ。
 *
 * セキュリティ:
 *  - email が存在しなくても同じ「メールを送信しました」を返す
 *    (列挙攻撃の防止。Supabase 側も同様の挙動)
 *  - エラーがあっても汎用メッセージのみ返す(内部詳細は console.error)
 *
 * origin の取得:
 *  - Vercel 環境では host ヘッダーで本番ドメイン
 *  - ローカル開発では localhost:3000
 *  - env NEXT_PUBLIC_SITE_URL が設定されていればそれを優先
 */
export async function forgotPasswordAction(
  raw: ForgotPasswordInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "入力に誤りがあります",
    };
  }

  const supabase = createClient();
  const origin = resolveOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    },
  );

  if (error) {
    // Supabase 側のエラーをログには残しつつ、ユーザー向けは曖昧に
    // (列挙攻撃防止。"そのメールアドレスは登録されていません" などは
    //  わざと返さない)
    console.error("[forgotPasswordAction] failed", error);
    return { ok: true }; // success と同じ応答
  }

  return { ok: true };
}

function resolveOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv;

  const h = headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "https://re-dice.net";
}
