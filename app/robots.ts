import type { MetadataRoute } from "next";

/**
 * robots.txt の自動生成。
 *
 * Next.js App Router の File Convention で、app/robots.ts を置くと
 * /robots.txt にアクセスしたとき自動でテキストを生成する。
 *
 * 方針:
 *  - public 領域(/, /store, /store/[slug])はすべての user-agent に
 *    allow。SEO 流入を最大化
 *  - 認証必須の領域(admin/creator/library/checkout/auth)は disallow。
 *    クロールされてもログイン画面に戻されるだけで、検索インデックス
 *    汚染になるので明示的にブロック
 *  - 403 / 404 / error も disallow(SEO 価値なし、低品質ページ扱い回避)
 *  - sitemap への参照を含めて、クローラーが自動的に sitemap.xml を
 *    発見できるようにする
 *
 * baseUrl は metadataBase / sitemap.ts と同じ NEXT_PUBLIC_SITE_URL を使用。
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://trpg-tan.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          "/creator",
          "/creator/",
          "/library",
          "/checkout/",
          "/auth/",
          "/403",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
