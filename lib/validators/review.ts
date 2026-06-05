import { z } from "zod";

/**
 * 作品レビュー(Steam ライク: positive / negative + comment)。
 *
 * DB CHECK 制約:
 *   - rating: 'positive' | 'negative'
 *   - comment: <= 2000 字
 *
 * 整形ルール:
 *   - comment は trim はしない(改行 / インデントを意図する場合があるため)
 */

export const reviewRatingSchema = z.enum(["positive", "negative"]);

export const reviewSubmitSchema = z.object({
  rating: reviewRatingSchema,
  comment: z
    .string()
    .max(2000, "コメントは 2000 文字以下で入力してください")
    .default(""),
});

export type ReviewRating = z.infer<typeof reviewRatingSchema>;
export type ReviewSubmitInput = z.infer<typeof reviewSubmitSchema>;

/**
 * creator がレビューに対する返信を投稿するときのバリデータ。
 * body は最小 1 / 最大 2000 字。
 */
export const reviewReplySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "返信内容を入力してください")
    .max(2000, "返信は 2000 文字以下で入力してください"),
});

export type ReviewReplyInput = z.infer<typeof reviewReplySchema>;
