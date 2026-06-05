import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductStatus } from "@/lib/format/status";

/**
 * creator ダッシュボード(BBBBBB)用の集計クエリ。自分の全作品に対する
 * 売上 / レビューのサマリと、ベストセラー作品を 1 関数で返す。
 *
 * 集計手順:
 *  1. 自分の products を取得(id / title / slug / status / cover_path)
 *  2. paid purchases を product_id in (...) で取得 → 作品別 / 合計を集計
 *  3. product_reviews を product_id in (...) で取得 → positive/negative 集計
 *  4. 売上トップの作品を特定
 *
 * α 期間の規模なら JS 集計で十分。失敗時は安全側(0 / null)で返す。
 */

export interface DashboardTopProduct {
  id: string;
  slug: string;
  title: string;
  coverPath: string | null;
  salesCount: number;
}

/**
 * ダッシュボードの「最近のレビュー」一覧 1 件分(CCCCCC)。どの作品に
 * 対するレビューかと、creator が返信済みかどうかを併せて返す。
 */
export interface DashboardRecentReview {
  id: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  rating: "positive" | "negative";
  comment: string;
  createdAt: string;
  reviewerName: string;
  reviewerAvatarPath: string | null;
  /** creator が既に返信済みか(未返信なら対応を促せる)*/
  hasReply: boolean;
}

export interface CreatorDashboardStats {
  productCount: number;
  publishedCount: number;
  draftCount: number;
  suspendedCount: number;
  totalSales: number;
  reviews: {
    total: number;
    positive: number;
    negative: number;
    /** 好評率(0–1)。total=0 なら null */
    positiveRatio: number | null;
  };
  /** 売上トップの作品(売上 0 のときは null)*/
  topProduct: DashboardTopProduct | null;
  /** 最近のレビュー(新しい順、最大 5 件)*/
  recentReviews: DashboardRecentReview[];
}

export async function getCreatorDashboardStats(
  userId: string,
): Promise<CreatorDashboardStats> {
  const supabase = createClient();

  // Step 1: 自分の products
  const { data: productRows, error: prodErr } = await supabase
    .from("products")
    .select("id, slug, title, status, cover_path")
    .eq("creator_id", userId);

  if (prodErr) {
    console.error("[getCreatorDashboardStats] products failed", prodErr);
    return emptyStats();
  }

  const products = productRows ?? [];
  const productCount = products.length;
  let publishedCount = 0;
  let draftCount = 0;
  let suspendedCount = 0;
  for (const p of products) {
    const s = p.status as ProductStatus;
    if (s === "published") publishedCount++;
    else if (s === "draft") draftCount++;
    else if (s === "suspended") suspendedCount++;
  }

  if (productCount === 0) {
    return {
      ...emptyStats(),
      productCount: 0,
    };
  }

  const productIds = products.map((p) => p.id);
  // 作品 id → {slug, title} の引き当て表(最近のレビュー表示で使う)
  const productMeta = new Map(
    products.map((p) => [p.id, { slug: p.slug, title: p.title }] as const),
  );

  // Step 2-4: purchases + reviews(集計用)+ 最近のレビュー(表示用)を並行 fetch
  const [purchasesRes, reviewsRes, recentRes] = await Promise.all([
    supabase
      .from("purchases")
      .select("product_id")
      .eq("status", "paid")
      .in("product_id", productIds),
    supabase
      .from("product_reviews")
      .select("rating")
      .in("product_id", productIds),
    supabase
      .from("product_reviews")
      .select("id, product_id, user_id, rating, comment, created_at")
      .in("product_id", productIds)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (purchasesRes.error) {
    console.error(
      "[getCreatorDashboardStats] purchases failed",
      purchasesRes.error,
    );
  }
  if (reviewsRes.error) {
    console.error(
      "[getCreatorDashboardStats] reviews failed",
      reviewsRes.error,
    );
  }
  if (recentRes.error) {
    console.error(
      "[getCreatorDashboardStats] recent reviews failed",
      recentRes.error,
    );
  }

  // 作品別 sales count + 合計
  const salesByProduct = new Map<string, number>();
  let totalSales = 0;
  for (const row of purchasesRes.data ?? []) {
    salesByProduct.set(
      row.product_id,
      (salesByProduct.get(row.product_id) ?? 0) + 1,
    );
    totalSales++;
  }

  // レビュー集計
  let positive = 0;
  let negative = 0;
  for (const row of reviewsRes.data ?? []) {
    if (row.rating === "positive") positive++;
    else if (row.rating === "negative") negative++;
  }
  const reviewTotal = positive + negative;

  // Step 4: 売上トップ作品
  let topProduct: DashboardTopProduct | null = null;
  let topCount = 0;
  for (const p of products) {
    const c = salesByProduct.get(p.id) ?? 0;
    if (c > topCount) {
      topCount = c;
      topProduct = {
        id: p.id,
        slug: p.slug,
        title: p.title,
        coverPath: p.cover_path,
        salesCount: c,
      };
    }
  }

  // 最近のレビュー(CCCCCC): 投稿者プロフィール + 返信有無を埋めて整形
  const recentReviews = await buildRecentReviews(
    recentRes.data ?? [],
    productMeta,
  );

  return {
    productCount,
    publishedCount,
    draftCount,
    suspendedCount,
    totalSales,
    reviews: {
      total: reviewTotal,
      positive,
      negative,
      positiveRatio: reviewTotal === 0 ? null : positive / reviewTotal,
    },
    topProduct,
    recentReviews,
  };
}

/**
 * 最近のレビュー行(product_reviews)を表示用 DashboardRecentReview に整形。
 * 投稿者の display_name / avatar(public_profiles)と、creator 返信の有無
 * (review_replies)を一括引き当てして N+1 を避ける。
 */
async function buildRecentReviews(
  rows: Array<{
    id: string;
    product_id: string;
    user_id: string;
    rating: string;
    comment: string | null;
    created_at: string;
  }>,
  productMeta: Map<string, { slug: string; title: string }>,
): Promise<DashboardRecentReview[]> {
  if (rows.length === 0) return [];

  const supabase = createClient();
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const reviewIds = rows.map((r) => r.id);

  const [profilesRes, repliesRes] = await Promise.all([
    supabase
      .from("public_profiles")
      .select("id, display_name, avatar_path")
      .in("id", userIds),
    supabase.from("review_replies").select("review_id").in("review_id", reviewIds),
  ]);

  const profileMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p] as const),
  );
  const repliedSet = new Set(
    (repliesRes.data ?? []).map((r) => r.review_id),
  );

  return rows.map((r) => {
    const profile = profileMap.get(r.user_id);
    const meta = productMeta.get(r.product_id);
    return {
      id: r.id,
      productId: r.product_id,
      productSlug: meta?.slug ?? "",
      productTitle: meta?.title ?? "(不明な作品)",
      rating: r.rating === "negative" ? "negative" : "positive",
      comment: r.comment ?? "",
      createdAt: r.created_at,
      reviewerName: profile?.display_name ?? "",
      reviewerAvatarPath: profile?.avatar_path ?? null,
      hasReply: repliedSet.has(r.id),
    };
  });
}

function emptyStats(): CreatorDashboardStats {
  return {
    productCount: 0,
    publishedCount: 0,
    draftCount: 0,
    suspendedCount: 0,
    totalSales: 0,
    reviews: { total: 0, positive: 0, negative: 0, positiveRatio: null },
    topProduct: null,
    recentReviews: [],
  };
}
