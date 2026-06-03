"use server";

import { createClient } from "@/lib/supabase/server";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validators/auth";

/**
 * 新パスワードを保存する。
 *
 * このアクションは「リセットメールのリンクをクリック → /auth/callback で
 * セッション確立 → /reset-password に着地」した状態の session を
 * 前提にしている。session が無いと updateUser は失敗する(Supabase が
 * 401 を返す)。
 *
 * 成功後はクライアント側で「完了しました」表示 → /login にリダイレクトを
 * 促す導線にする(session はそのまま継続するが、明示的に再ログイン体験を
 * 提供することで「自分が思った操作になっている」感を出す)。
 */
export async function resetPasswordAction(
  raw: ResetPasswordInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "入力に誤りがあります",
    };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    console.error("[resetPasswordAction] failed", error);
    // session が切れていた場合のエラーをわかりやすく
    if (error.message.toLowerCase().includes("session")) {
      return {
        ok: false,
        error:
          "セッションが切れています。お手数ですが、もう一度メールのリンクからやり直してください。",
      };
    }
    return {
      ok: false,
      error: "パスワードの保存に失敗しました。少し時間をおいて再度お試しください。",
    };
  }

  return { ok: true };
}
