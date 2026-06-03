import { z } from "zod";

/**
 * 自分のプロフィール編集用バリデータ。
 *
 * DB の CHECK 制約と整合させた長さ上限:
 *   - display_name:   50 字以下
 *   - bio:            500 字以下
 *   - twitter_handle: 50 字以下(@ 抜きで保存)
 *   - website_url:    200 字以下、URL 形式(空文字許可)
 *
 * 整形ルール:
 *   - twitter_handle: 先頭 @ や URL 形式を入力されても server action 側で
 *     ハンドル部分だけに正規化する。本スキーマでは「文字列の長さ」のみ
 *     チェックして、形式自体は受け入れる(緩い）
 *   - website_url: 空文字はそのまま許可、入力があれば http(s):// で
 *     始まる必要がある
 */
export const profileEditSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(50, "表示名は 50 文字以下で入力してください"),
  bio: z
    .string()
    .max(500, "自己紹介は 500 文字以下で入力してください")
    // bio は意図的に trim しない(冒頭の改行などを保つ)
    .default(""),
  twitterHandle: z
    .string()
    .trim()
    .max(50, "Twitter ハンドルは 50 文字以下で入力してください")
    .default(""),
  websiteUrl: z
    .string()
    .trim()
    .max(200, "URL は 200 文字以下で入力してください")
    .refine(
      (v) => v === "" || /^https?:\/\//i.test(v),
      "URL は http:// または https:// で始めてください",
    )
    .default(""),
});

export type ProfileEditInput = z.infer<typeof profileEditSchema>;

/**
 * Twitter ハンドルの正規化。「@xxx」「https://twitter.com/xxx」「xxx」を
 * 受けて「xxx」(@抜きのハンドル文字列)に揃える。空文字なら空のまま。
 */
export function normalizeTwitterHandle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // URL 形式
  const urlMatch = trimmed.match(
    /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/(@?[A-Za-z0-9_]+)/i,
  );
  if (urlMatch) {
    return urlMatch[1].replace(/^@/, "");
  }

  // @ プレフィクス
  if (trimmed.startsWith("@")) {
    return trimmed.slice(1);
  }

  return trimmed;
}
