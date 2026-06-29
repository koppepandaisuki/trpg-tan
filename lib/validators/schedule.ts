import { z } from "zod";

/**
 * 日程調整ツールの入力スキーマ(client の検証と server の safeParse で共有)。
 * クライアントの検証だけを信用せず、route handler でも必ず safeParse する。
 */

export const voteStateEnum = z.enum(["yes", "maybe", "no"]);
export const scheduleModeEnum = z.enum(["list", "grid"]);

/** 候補スロットの上限(grid で自動生成しても膨張させない)。 */
export const SLOTS_MAX = 60;
export const TITLE_MAX = 200;
export const MEMO_MAX = 4000;
export const NAME_MAX = 60;
export const COMMENT_MAX = 2000;

export const scenarioRefSchema = z.object({
  kind: z.enum(["product", "free"]),
  productId: z.string().uuid().optional(),
  slug: z.string().max(200).optional(),
  title: z.string().trim().min(1).max(TITLE_MAX),
  coverPath: z.string().max(500).nullish(),
});

export const createEventSchema = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください").max(TITLE_MAX),
  memo: z.string().max(MEMO_MAX).optional().default(""),
  mode: scheduleModeEnum.default("list"),
  deadline: z.string().datetime().nullish(),
  scenarioRef: scenarioRefSchema.nullish(),
  slots: z
    .array(
      z.object({
        startsAt: z.string().datetime(),
        label: z.string().max(100).optional().default(""),
      }),
    )
    .min(1, "候補を1つ以上追加してください")
    .max(SLOTS_MAX, `候補は最大${SLOTS_MAX}件までです`),
});

export const voteSchema = z.object({
  voterKey: z.string().trim().min(1).max(80),
  voterName: z.string().trim().min(1, "名前を入力してください").max(NAME_MAX),
  entries: z
    .array(
      z.object({
        slotId: z.string().uuid(),
        state: voteStateEnum,
      }),
    )
    .min(1)
    .max(SLOTS_MAX),
});

export const commentSchema = z.object({
  name: z.string().trim().min(1, "名前を入力してください").max(NAME_MAX),
  text: z.string().trim().min(1, "コメントを入力してください").max(COMMENT_MAX),
});

/** 主催(管理トークン)の操作。 */
export const manageSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("finalize"), slotId: z.string().uuid().nullable() }),
  z.object({
    op: z.literal("update"),
    title: z.string().trim().min(1).max(TITLE_MAX).optional(),
    memo: z.string().max(MEMO_MAX).optional(),
    deadline: z.string().datetime().nullish(),
  }),
  z.object({ op: z.literal("delete") }),
]);

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type VoteInput = z.infer<typeof voteSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type ManageInput = z.infer<typeof manageSchema>;
