import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductType, FileFormat, ProductReviewSummary } from "./types";
import type { ProductStatus } from "@/lib/format/status";
import { fetchReviewSummariesByProductIds } from "./reviews";

/**
 * Creator-scoped queries.
 *
 * Every function takes the userId explicitly so the caller has already
 * gone through requireCreator() — these helpers do NOT re-derive identity.
 *
 * Defense in depth: queries filter by creator_id even though RLS already
 * restricts access. file_path is intentionally NOT selected.
 */

export type MyProductListItem = {
  id: string;
  slug: string;
  title: string;
  productType: ProductType;
  status: ProductStatus;
  priceJpy: number;
  coverPath: string | null;
  updatedAt: string;
  publishedAt: string | null;
  /** paid purchase の累計件数。集計失敗時は 0。 */
  salesCount: number;
  /** レビュー集計。0 件 / 集計失敗時は null で UI 側は非表示。 */
  reviewSummary: ProductReviewSummary | null;
};

export type MyProductDetail = {
  id: string;
  slug: string;
  title: string;
  description: string;
  productType: ProductType;
  fileFormat: FileFormat;
  priceJpy: number;
  status: ProductStatus;
  coverPath: string | null;
  systemLabel: string | null;
  players: string | null;
  playtime: string | null;
  recommendedSkills: string | null;
  allowCommercial: boolean;
  allowRedistribution: boolean;
  publishedAt: string | null;
  updatedAt: string;
  tags: string[];
};

const LIST_COLUMNS =
  "id, slug, title, product_type, status, price_jpy, cover_path, updated_at, published_at";

const DETAIL_COLUMNS =
  // file_path is intentionally omitted — Phase 5 has no use for it.
  [
    "id",
    "slug",
    "title",
    "description",
    "product_type",
    "file_format",
    "price_jpy",
    "status",
    "cover_path",
    "system_label",
    "players",
    "playtime",
    "recommended_skills",
    "allow_commercial",
    "allow_redistribution",
    "published_at",
    "updated_at",
    "creator_id",
  ].join(", ");

/**
 * Row shape returned by `getMyProductById`'s SELECT. Mirrors DETAIL_COLUMNS.
 * Used with `.returns<...>()` so PostgREST's string-parse type inference
 * doesn't collapse to GenericStringError when the column list is built
 * from a non-literal string.
 */
type MyProductDetailRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  product_type: string;
  file_format: string;
  price_jpy: number;
  status: string;
  cover_path: string | null;
  system_label: string | null;
  players: string | null;
  playtime: string | null;
  recommended_skills: string | null;
  allow_commercial: boolean;
  allow_redistribution: boolean;
  published_at: string | null;
  updated_at: string;
  creator_id: string;
};

export async function listMyProducts(
  userId: string,
): Promise<MyProductListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select(LIST_COLUMNS)
    .eq("creator_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[listMyProducts] failed", error);
    return [];
  }

  const rows = data ?? [];
  if (rows.length === 0) return [];

  // 集計: 自作品の paid purchases + 全レビュー summary を並行 fetch
  const productIds = rows.map((r) => r.id);
  const [purchasesRes, reviewMap] = await Promise.all([
    supabase
      .from("purchases")
      .select("product_id")
      .eq("status", "paid")
      .in("product_id", productIds),
    fetchReviewSummariesByProductIds(productIds),
  ]);

  if (purchasesRes.error) {
    console.error(
      "[listMyProducts] purchases fetch failed",
      purchasesRes.error,
    );
  }

  // product 別の sales count を集計
  const salesByProduct = new Map<string, number>();
  for (const p of purchasesRes.data ?? []) {
    salesByProduct.set(
      p.product_id,
      (salesByProduct.get(p.product_id) ?? 0) + 1,
    );
  }

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    productType: r.product_type as ProductType,
    status: r.status as ProductStatus,
    priceJpy: r.price_jpy,
    coverPath: r.cover_path,
    updatedAt: r.updated_at,
    publishedAt: r.published_at,
    salesCount: salesByProduct.get(r.id) ?? 0,
    reviewSummary: reviewMap.get(r.id) ?? null,
  }));
}

/**
 * Returns null when:
 *   - the id is not a valid UUID,
 *   - the product does not exist,
 *   - or the product belongs to another user.
 *
 * Caller should call notFound() on null per Phase 5 design.
 */
export async function getMyProductById(
  userId: string,
  id: string,
): Promise<MyProductDetail | null> {
  const supabase = createClient();

  const { data: row, error } = await supabase
    .from("products")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .eq("creator_id", userId)
    .returns<MyProductDetailRow[]>()
    .maybeSingle();

  if (error || !row) {
    if (error) console.error("[getMyProductById] failed", error);
    return null;
  }

  const { data: tagRows, error: tagErr } = await supabase
    .from("product_tags")
    .select("tag")
    .eq("product_id", id);

  if (tagErr) {
    console.error("[getMyProductById] tag fetch failed", tagErr);
  }

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    productType: row.product_type as ProductType,
    fileFormat: row.file_format as FileFormat,
    priceJpy: row.price_jpy,
    status: row.status as ProductStatus,
    coverPath: row.cover_path,
    systemLabel: row.system_label,
    players: row.players,
    playtime: row.playtime,
    recommendedSkills: row.recommended_skills,
    allowCommercial: row.allow_commercial,
    allowRedistribution: row.allow_redistribution,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    tags: (tagRows ?? []).map((t) => t.tag),
  };
}
