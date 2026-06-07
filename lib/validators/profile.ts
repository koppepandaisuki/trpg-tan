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
/** SNS リンク 1 件(入力用・緩め)。実際の検証/整形は sanitizeSocialLinks。 */
export const socialLinkInputSchema = z.object({
  label: z.string().max(60).default(""),
  url: z.string().max(300).default(""),
});
export type SocialLinkInput = z.infer<typeof socialLinkInputSchema>;

/** 保存される SNS リンク(整形済み)。 */
export interface SocialLink {
  label: string;
  url: string;
}

/** 1 プロフィールに保存できる SNS リンクの上限。 */
export const MAX_SOCIAL_LINKS = 8;

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
  // 任意の SNS リンク集(行ごと label + url)。空行は server で除去。
  socialLinks: z.array(socialLinkInputSchema).max(20).default([]),
});

export type ProfileEditInput = z.infer<typeof profileEditSchema>;

/** URL からホスト名(www 抜き)を取り出す。ラベル未入力時の代替表示に使う。 */
export function domainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * 入力された SNS リンク配列を保存用に整形:
 *   - url が http(s):// のものだけ残す
 *   - label/url を trim + 長さ制限
 *   - label 未入力ならドメイン名で代替
 *   - 先頭 MAX_SOCIAL_LINKS 件まで
 */
export function sanitizeSocialLinks(
  links: SocialLinkInput[] | undefined,
): SocialLink[] {
  return (links ?? [])
    .map((l) => ({
      label: (l.label ?? "").trim().slice(0, 30),
      url: (l.url ?? "").trim().slice(0, 200),
    }))
    .filter((l) => /^https?:\/\//i.test(l.url))
    .slice(0, MAX_SOCIAL_LINKS)
    .map((l) => ({ label: l.label || domainLabel(l.url), url: l.url }));
}

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
