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
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
