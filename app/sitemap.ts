import type { MetadataRoute } from "next";

/**
 * sitemap.xml の自動生成(app/sitemap.ts → /sitemap.xml)。
 *
 * 2026-09 にストア(作品売買)を廃止したので、作品ページ(/store/[slug])の
 * 動的ルートは無くなり、公開ページだけの静的な一覧になった。
 *
 * 含めないルート(robots.ts の disallow と整合):
 *  - /admin/*, /library, /play/*  (ログインユーザー専用)
 *  - /checkout/*, /auth/*          (一時的な遷移ページ)
 *  - /403, /404                    (エラー画面)
 *
 * baseUrl は metadataBase と同じ NEXT_PUBLIC_SITE_URL を使用。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://re-dice.net";
  const now = new Date();

  const route = (
    path: string,
    changeFrequency: "daily" | "weekly" | "monthly" | "yearly",
    priority: number,
  ): MetadataRoute.Sitemap[number] => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  return [
    route("/", "weekly", 1.0),
    route("/download", "weekly", 0.8),
    route("/schedule/new", "monthly", 0.6),
    route("/pricing", "monthly", 0.5),
    route("/signup", "monthly", 0.5),
    route("/help", "monthly", 0.4),
    route("/login", "monthly", 0.3),
    route("/terms", "yearly", 0.2),
    route("/privacy", "yearly", 0.2),
    route("/legal/tokushoho", "yearly", 0.2),
  ];
}
