import { z } from "zod";

/**
 * Product input schemas.
 *
 * Two schemas because draft and publish have different strictness:
 *   - draftSchema:   lenient. Anything not obviously broken is accepted.
 *   - publishSchema: strict. Used when transitioning to status='published'.
 *
 * Both are shared between client (zodResolver) and server (safeParse in
 * Server Actions). Never trust the client check alone.
 *
 * Tags are trimmed + lowercased before storage to match the DB CHECK
 * constraint (tag = lower(tag)).
 */

// ---------------------------------------------------------------------
// Tag constants and helpers
// ---------------------------------------------------------------------

export const TAG_MAX_LENGTH = 30;
export const TAGS_MAX_COUNT = 10;

/** Normalize a single tag candidate. Returns null if invalid/empty. */
export function normalizeTag(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.length > TAG_MAX_LENGTH) return null;
  return trimmed;
}

const tagSchema = z
  .string()
  .trim()
  .min(1, "タグが空です")
  .max(TAG_MAX_LENGTH, `タグは${TAG_MAX_LENGTH}文字以内で入力してください`)
  .refine((s) => s === s.toLowerCase(), {
    message: "タグは小文字で入力してください",
  });

// ---------------------------------------------------------------------
// Enums (mirrors DB CHECK constraints)
// ---------------------------------------------------------------------

export const productTypeEnum = z.enum([
  "full_package",
  "scenario",
  "rulebook",
  "character_art",
  "map",
  "bgm_audio",
]);

export const fileFormatEnum = z.enum(["pdf", "image_zip", "audio", "pack"]);

// ---------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------

const baseFields = {
  title: z
    .string()
    .trim()
    .min(1, "タイトルを入力してください")
    .max(100, "タイトルは100文字以内で入力してください"),
  description: z
    .string()
    .max(10000, "説明は10000文字以内で入力してください")
    .default(""),
  productType: productTypeEnum,
  fileFormat: fileFormatEnum,
  priceJpy: z.coerce
    .number({ invalid_type_error: "価格は数値で入力してください" })
    .int("価格は整数で入力してください")
    .min(0, "価格は0円以上で入力してください")
    .max(10000000, "価格は10,000,000円以下で入力してください"),
  systemLabel: z.string().max(100).default(""),
  players: z.string().max(50).default(""),
  playtime: z.string().max(50).default(""),
  recommendedSkills: z.string().max(200).default(""),
  allowCommercial: z.coerce.boolean().default(false),
  allowRedistribution: z.coerce.boolean().default(false),
  tags: z
    .array(tagSchema)
    .max(TAGS_MAX_COUNT, `タグは${TAGS_MAX_COUNT}個以下にしてください`)
    .default([]),
};

/** Lenient — used by 「下書き保存」 */
export const draftSchema = z.object(baseFields);

/** Strict — used by 「公開して保存」. Additional required fields kick in here. */
export const publishSchema = z.object({
  ...baseFields,
  // title and priceJpy are already enforced.
  description: z
    .string()
    .trim()
    .min(1, "公開には説明文の入力が必要です")
    .max(10000),
  tags: z
    .array(tagSchema)
    .min(1, "公開にはタグを1つ以上設定してください")
    .max(TAGS_MAX_COUNT),
});

export type ProductInput = z.infer<typeof draftSchema>;
export type PublishProductInput = z.infer<typeof publishSchema>;

/**
 * Form-side schema used by react-hook-form's zodResolver.
 * Identical to draftSchema; publish-specific checks run on the server
 * (so users can edit a draft freely without seeing publish errors until
 * they click 「公開して保存」).
 */
export const builderFormSchema = draftSchema;
export type BuilderFormValues = z.infer<typeof builderFormSchema>;
