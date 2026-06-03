import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * sitemap.xml 用の軽量クエリ。
 *
 * 通常の listPublishedProducts はストアグリッド表示用の詳細(cover_path,
 * creator profile, system_label など)を取るが、sitemap には URL +
 * 最終更新日があれば十分。本クエリは:
 *
 *  - slug と updated_at のみ select(JOIN なし)
 *  - 公開中(status="published")のみ
 *  - updated_at desc で並べる
 *  - limit 5000(sitemap の Google 上限 50,000 URL を考慮しつつ、現実的な
 *    α 期間中の作品数を大きく上回る数値で頭打ち)
 *
 * 失敗時は空配列を返し sitemap 生成を継続(クロール完全停止より部分的
 * クロール継続のほうが SEO に good)。
 */
export interface SitemapProductEntry {
  slug: string;
  updatedAt: string;
}

export async function listSitemapEntries(): Promise<SitemapProductEntry[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("products")
    .select("slug, updated_at")
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(5000);

  if (error) {
    console.error("[listSitemapEntries] failed", error);
    return [];
  }

  return (data ?? []).map((r) => ({
    slug: r.slug,
    updatedAt: r.updated_at,
  }));
}
