import type { MetadataRoute } from "next";
import { listSitemapEntries } from "@/lib/queries/sitemap";

/**
 * sitemap.xml の自動生成。
 *
 * Next.js App Router の File Convention で、app/sitemap.ts を置くと
 * /sitemap.xml にアクセスしたとき自動で XML を生成する。
 *
 * 含めるルート:
 *  - / (ホーム)
 *  - /store (作品一覧、最重要 SEO 入口)
 *  - /store/[slug] (各作品詳細、動的)
 *  - /login, /signup (auth 入口、優先度低)
 *
 * 含めないルート(robots.ts で disallow と整合):
 *  - /admin/*  (管理画面、サインインが必要)
 *  - /creator/* (creator 専用、サインインが必要)
 *  - /library  (ログインユーザー専用)
 *  - /checkout/* (一時的な遷移ページ)
 *  - /auth/*   (callback / sign-out)
 *  - /403, /404 (エラー画面)
 *
 * baseUrl は metadataBase と同じ NEXT_PUBLIC_SITE_URL を使用。
 *
 * revalidate を 1 時間にして、Vercel が頻繁に DB クエリを叩くのを抑制
 * しつつ、新規商品の取り込みは 1 時間以内に行われる。
 */

export const revalidate = 3600; // 1 hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://trpg-tan.vercel.app";

  const now = new Date();

  // 静的ルート。priority と changeFrequency はサイトの構造に応じた
  // SEO 重要度を反映:
  //  - / (1.0): サイトのトップ、最重要
  //  - /store (0.9): SEO 流入の主要先
  //  - /signup (0.5): コンバージョン入口、中程度
  //  - /login (0.3): 既存ユーザー向け、低
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/store`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // 動的ルート(商品詳細)。lastModified は商品の updated_at を使い、
  // 編集された商品が「最近更新された」と検索エンジンに伝わる。
  const products = await listSitemapEntries();
  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${baseUrl}/store/${p.slug}`,
    lastModified: new Date(p.updatedAt),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...productRoutes];
}
