import { z } from "zod";

/**
 * Feedback input schema (in-app feedback button).
 *
 * α 期間中の収集インフラ。ログイン済ユーザーのみが POST するため、
 * user 情報(id / email / displayName)はサーバー側で getCurrentUser から
 * 取り直し、スキーマ自体は最小限の入力フィールドだけ持つ。
 *
 * `pageUrl` はクライアントが `window.location.href` を自動で添付するが、
 * 値が無くても受け付ける(ボタンを Server Component から呼んだ場合等)。
 */

export const feedbackCategoryEnum = z.enum([
  "bug",
  "feature_request",
  "question",
  "other",
]);

export type FeedbackCategory = z.infer<typeof feedbackCategoryEnum>;

export const feedbackInputSchema = z.object({
  category: feedbackCategoryEnum,
  body: z
    .string()
    .trim()
    .min(3, "本文は 3 文字以上で入力してください")
    .max(1000, "本文は 1000 文字以内で入力してください"),
  pageUrl: z.string().url().max(500).optional(),
});

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;
