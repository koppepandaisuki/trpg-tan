import { z } from "zod";

/**
 * Auth form schemas. Shared between client (react-hook-form / zodResolver)
 * and server (Server Action safeParse) so validation never diverges.
 *
 * Keep messages in Japanese — they are shown directly to users.
 */

export const emailSchema = z
  .string()
  .min(1, "メールアドレスを入力してください")
  .email("メールアドレスの形式が正しくありません")
  .max(254, "メールアドレスが長すぎます");

export const passwordSchema = z
  .string()
  .min(8, "パスワードは8文字以上で入力してください")
  .max(72, "パスワードは72文字以内で入力してください"); // bcrypt limit

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z
    .string()
    .trim()
    .min(1, "表示名を入力してください")
    .max(50, "表示名は50文字以内で入力してください"),
  // 利用規約 / プライバシーポリシーへの同意(TTTTT)。チェックされて
  // いない(false)と submit できない。boolean + refine で「true 必須」を
  // 表現(z.literal(true) はバージョン差で message が出ないことがある)。
  agreedToTerms: z.boolean().refine((v) => v === true, {
    message: "利用規約とプライバシーポリシーへの同意が必要です",
  }),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

/**
 * 設定ページからのパスワード変更。
 * newPassword と confirmPassword が一致することを検証(typo 防止)。
 * 「現在のパスワード」は Supabase 標準の updateUser では不要だが、UX 上
 * 念のため入力させたい場合は後日 schema に追加して再認証フローを組む。
 */
export const changePasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "確認用パスワードが一致しません",
    path: ["confirmPassword"],
  });

/**
 * 設定ページからのメールアドレス変更。
 * 新しいメールアドレスの形式のみ検証(現在のメールとの一致禁止などは
 * Supabase 側 + server action で扱う)。
 */
export const changeEmailSchema = z.object({
  newEmail: emailSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
