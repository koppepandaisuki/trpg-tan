import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductType } from "./types";

/**
 * ストアランディング(絞り込みなしの /store)用の実データ集計。
 *
 *  - total: 公開作品数(信頼バー「公開作品」+ ヒーロー文言)
 *  - creatorCount: 公開作品を持つクリエイターの実数(信頼バー)
 *  - avgStars: 全レビューの平均星(信頼バー。レビュー 0 件なら null で
 *    呼び出し側がタイルごと非表示にする — 見せかけの数字は出さない)
 *  - categoryCounts: カテゴリ別の公開作品数(サイコロの目カテゴリタイル)
 *
 * products は slim select(creator_id, product_type)1 本で total /
 * creatorCount / categoryCounts をまとめて数える。規模注意: 数千件までは
 * これで十分。超えたら RPC / materialized view へ(listByRating と同方針)。
 */

export interface StoreOverview {
  total: number;
  creatorCount: number;
  avgStars: number | null;
  categoryCounts: Partial<Record<ProductType, number>>;
}

const EMPTY: StoreOverview = {
  total: 0,
  creatorCount: 0,
  avgStars: null,
  categoryCounts: {},
};

export async function getStoreOverview(): Promise<StoreOverview> {
  const supabase = createClient();

  const [prodRes, reviewRes] = await Promise.all([
    supabase
      .from("products")
      .select("creator_id, product_type")
      .eq("status", "published")
      .limit(5000),
    supabase.from("product_reviews").select("stars").limit(5000),
  ]);

  if (prodRes.error) {
    console.error("[getStoreOverview] products failed", prodRes.error);
    return EMPTY;
  }

  const rows = prodRes.data ?? [];
  const creators = new Set<string>();
  const categoryCounts: Partial<Record<ProductType, number>> = {};
  for (const r of rows) {
    creators.add(r.creator_id);
    const t = r.product_type as ProductType;
    categoryCounts[t] = (categoryCounts[t] ?? 0) + 1;
  }

  // レビュー平均は取れなくてもランディングは成立する(失敗は null 扱い)。
  let avgStars: number | null = null;
  if (!reviewRes.error && reviewRes.data && reviewRes.data.length > 0) {
    const stars = reviewRes.data
      .map((r) => Number(r.stars))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
    if (stars.length > 0) {
      avgStars = stars.reduce((a, b) => a + b, 0) / stars.length;
    }
  }

  return {
    total: rows.length,
    creatorCount: creators.size,
    avgStars,
    categoryCounts,
  };
}
