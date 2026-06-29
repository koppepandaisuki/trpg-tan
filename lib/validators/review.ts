import { z } from "zod";

/**
 * 作品レビュー(5 段階の星評価 + comment)。
 *
 * DB CHECK 制約:
 *   - stars: 1..5 の整数
 *   - comment: <= 2000 字
 *   - (後方互換)rating: 'positive' | 'negative' は stars から導出して保存
 *
 * 整形ルール:
 *   - comment は trim はしない(改行 / インデントを意図する場合があるため)
 */

export const reviewRatingSchema = z.enum(["positive", "negative"]);

export const reviewStarsSchema = z
  .number({ invalid_type_error: "星の数を選んでください" })
  .int()
  .min(1, "星は 1〜5 で選んでください")
  .max(5, "星は 1〜5 で選んでください");

export const reviewSubmitSchema = z.object({
  stars: reviewStarsSchema,
  comment: z
    .string()
    .max(2000, "コメントは 2000 文字以下で入力してください")
    .default(""),
});

/** 星(1..5)から後方互換の rating を導出(4 以上=高評価)。 */
export function ratingFromStars(stars: number): ReviewRating {
  return stars >= 4 ? "positive" : "negative";
}

export type ReviewRating = z.infer<typeof reviewRatingSchema>;
export type ReviewStars = z.infer<typeof reviewStarsSchema>;
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
