import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductListItem, ProductType } from "./types";
import type { ReviewLabel } from "./reviews";
import type { SocialLink } from "@/lib/validators/profile";

function toSocialLinks(raw: unknown): SocialLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (l): l is SocialLink =>
        !!l &&
        typeof l === "object" &&
        typeof (l as SocialLink).url === "string",
    )
    .map((l) => ({ label: l.label ?? "", url: l.url }));
}

/**
 * 平均星から総合評価ラベルを算出。reviews.ts の computeStarLabel と同基準を
 * ローカルに持つ(循環依存回避)。基準が変わったら両方を更新すること。
 */
function computeStarLabel(avgStars: number | null, total: number): ReviewLabel {
  if (total === 0 || avgStars === null) return "評価なし";
  if (total < 3) return "評価不足";
  if (avgStars >= 4.5) return "圧倒的に好評";
  if (avgStars >= 4.0) return "非常に好評";
  if (avgStars >= 3.5) return "ほぼ好評";
  if (avgStars >= 2.5) return "賛否両論";
  if (avgStars >= 2.0) return "やや不評";
  if (avgStars >= 1.5) return "不評";
  return "圧倒的に不評";
}

/**
 * 他人の creator プロフィール表示用クエリ。
 *
 * クリエイター(public_profiles の 1 行)+ そのクリエイターの公開作品
 * 全件をまとめて取る。public ルート(認証不要)で使うため、RLS は
 * 「public_profiles は全員参照可」「products は status='published' のみ」
 * を前提にしている。
 *
 * Note:
 *  - 作品は LIST 用の slim 列のみ select(file_path / description は不要)
 *  - 並び順は published_at desc(新しい作品が上)
 *  - 作品が 0 件でも profile は返す(新規 creator の歓迎用)
 *  - id が存在しない / 非公開ユーザー → null を返す
 */

/**
 * クリエイターの公開作品全体に対する集計(プロフィール hero 表示用)。
 * 作品ごとではなく「creator の累計」値。
 */
export interface CreatorAggregateStats {
  /** paid purchase の累計件数(全作品合計)*/
  totalSales: number;
  reviews: {
    total: number;
    positive: number;
    negative: number;
    /** 平均星(1–5)。total = 0 のときは 0。*/
    avgStars: number;
    label: ReviewLabel;
  };
}

export interface CreatorProfileView {
  id: string;
  displayName: string;
  avatarPath: string | null;
  bio: string;
  twitterHandle: string;
  websiteUrl: string;
  /** クリエイターが任意で足した SNS / 外部リンク。 */
  socialLinks: SocialLink[];
  products: ProductListItem[];
  /** 全作品の集計。products が 0 件のときも安全側で 0 / 評価なし */
  stats: CreatorAggregateStats;
}

export async function getCreatorProfile(
  id: string,
): Promise<CreatorProfileView | null> {
  const supabase = createClient();

  // Profile 取得
  const { data: profileRow, error: profileErr } = await supabase
    .from("public_profiles")
    .select(
      "id, display_name, avatar_path, bio, twitter_handle, website_url, social_links",
    )
    .eq("id", id)
    .maybeSingle();

  if (profileErr) {
    console.error("[getCreatorProfile] profile fetch failed", profileErr);
    return null;
  }
  if (!profileRow) return null;

  // 公開作品の取得(同一クリエイターの published のみ)
  const { data: productRows, error: productsErr } = await supabase
    .from("products")
    .select(
      "id, slug, title, product_type, price_jpy, discount_percent, cover_path, system_label, published_at",
    )
    .eq("creator_id", id)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (productsErr) {
    console.error("[getCreatorProfile] products fetch failed", productsErr);
    // profile はあるので products 空で返す(部分表示)
    return {
      id: profileRow.id,
      displayName: profileRow.display_name ?? "",
      avatarPath: profileRow.avatar_path,
      bio: profileRow.bio ?? "",
      twitterHandle: profileRow.twitter_handle ?? "",
      websiteUrl: profileRow.website_url ?? "",
      socialLinks: toSocialLinks(profileRow.social_links),
      products: [],
      stats: emptyStats(),
    };
  }

  const displayName = profileRow.display_name ?? "";

  const products: ProductListItem[] = (productRows ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    productType: r.product_type as ProductType,
    priceJpy: r.price_jpy,
    discountPercent: r.discount_percent ?? 0,
    coverPath: r.cover_path,
    systemLabel: r.system_label,
    publishedAt: r.published_at,
    creator: {
      id: profileRow.id,
      displayName,
      avatarPath: profileRow.avatar_path,
    },
  }));

  // 集計: 該当 creator の全作品 ID を対象に、paid purchases と
  // product_reviews を並行 fetch して JS で reduce。productRows は
  // 上で fetch 済なので、ID 集合は手元にある。
  const productIds = (productRows ?? []).map((r) => r.id);
  const stats = await computeCreatorStats(productIds);

  return {
    id: profileRow.id,
    displayName,
    avatarPath: profileRow.avatar_path,
    bio: profileRow.bio ?? "",
    twitterHandle: profileRow.twitter_handle ?? "",
    websiteUrl: profileRow.website_url ?? "",
    socialLinks: toSocialLinks(profileRow.social_links),
    products,
    stats,
  };
}

/**
 * クリエイターの全作品に対する売上 + レビューを集計。
 *
 * 集計手順:
 *  - productIds が空なら early return(空 stats)
 *  - paid purchases と product_reviews を並行 fetch
 *  - JS で count して整形
 *
 * 失敗時は部分的に 0 を返し、表示は崩れない方針。
 */
async function computeCreatorStats(
  productIds: string[],
): Promise<CreatorAggregateStats> {
  if (productIds.length === 0) return emptyStats();

  const supabase = createClient();

  const [purchasesRes, reviewsRes] = await Promise.all([
    supabase
      .from("purchases")
      .select("product_id")
      .eq("status", "paid")
      .in("product_id", productIds),
    supabase
      .from("product_reviews")
      .select("stars, rating")
      .in("product_id", productIds),
  ]);

  if (purchasesRes.error) {
    console.error(
      "[computeCreatorStats] purchases failed",
      purchasesRes.error,
    );
  }
  if (reviewsRes.error) {
    console.error("[computeCreatorStats] reviews failed", reviewsRes.error);
  }

  const totalSales = purchasesRes.data?.length ?? 0;

  let positive = 0;
  let negative = 0;
  let starSum = 0;
  const total = (reviewsRes.data ?? []).length;
  for (const r of reviewsRes.data ?? []) {
    const s =
      typeof r.stars === "number" && r.stars >= 1 && r.stars <= 5
        ? r.stars
        : r.rating === "positive"
          ? 5
          : 2;
    starSum += s;
    if (s >= 4) positive++;
    else if (s <= 2) negative++;
  }
  const avgStars = total === 0 ? 0 : starSum / total;

  return {
    totalSales,
    reviews: {
      total,
      positive,
      negative,
      avgStars,
      label: computeStarLabel(total === 0 ? null : avgStars, total),
    },
  };
}

function emptyStats(): CreatorAggregateStats {
  return {
    totalSales: 0,
    reviews: {
      total: 0,
      positive: 0,
      negative: 0,
      avgStars: 0,
      label: "評価なし",
    },
  };
}
