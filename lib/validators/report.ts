import { z } from "zod";

/**
 * 作品の通報(product_reports)。
 *
 * DB CHECK 制約と一致:
 *   - category: 'inappropriate' | 'offtopic' | 'copyright' | 'illegal' | 'spam' | 'other'
 *   - reason:   1〜1000 字
 */

export const reportCategorySchema = z.enum([
  "inappropriate",
  "offtopic",
  "copyright",
  "illegal",
  "spam",
  "other",
]);

export type ReportCategory = z.infer<typeof reportCategorySchema>;

/** 通報カテゴリの表示名(クライアント / サーバー両用)。 */
export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  inappropriate: "不適切な内容",
  offtopic: "TRPG 素材ではない",
  copyright: "著作権・権利侵害",
  illegal: "違法・規約違反",
  spam: "スパム・宣伝",
  other: "その他",
};

/** カテゴリ選択の表示順。 */
export const REPORT_CATEGORY_ORDER: ReportCategory[] = [
  "inappropriate",
  "offtopic",
  "copyright",
  "illegal",
  "spam",
  "other",
];

export const reportSubmitSchema = z.object({
  category: reportCategorySchema,
  reason: z
    .string()
    .trim()
    .min(1, "通報の理由を入力してください")
    .max(1000, "理由は 1000 文字以下で入力してください"),
});

export type ReportSubmitInput = z.infer<typeof reportSubmitSchema>;

/** 通報の処理状態。 */
export const reportStatusSchema = z.enum(["open", "reviewed", "dismissed"]);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  open: "未対応",
  reviewed: "対応済み",
  dismissed: "却下",
};
