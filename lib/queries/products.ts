import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  ProductDetail,
  ProductListItem,
  ProductType,
  FileFormat,
} from "./types";
import { fetchReviewSummariesByProductIds } from "./reviews";

/**
 * Page size for the store grid. Confirmed in Phase 4 design.
 */
export const STORE_PAGE_SIZE = 12;

const LIST_COLUMNS =
  "id, slug, title, product_type, price_jpy, cover_path, system_label, published_at, creator_id";

const DETAIL_COLUMNS =
  // Intentionally omits file_path / status / creator_id-from-leaking.
  // file_path is never selected here so it cannot accidentally render.
  [
    "id",
    "slug",
    "title",
    "description",
    "product_type",
    "file_format",
    "price_jpy",
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
 * Row shape returned by `getPublishedProductBySlug`'s SELECT. Mirrors
 * DETAIL_COLUMNS. Used with `.returns<...>()` so PostgREST's string-parse
 * type inference doesn't collapse to GenericStringError when the column
 * list comes from a non-literal string.
 */
type ProductDetailRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  product_type: string;
  file_format: string;
  price_jpy: number;
  cover_path: string | null;
  system_label: string | null;
  players: string | null;
  playtime: string | null;
  recommended_skills: string | null;
  allow_commercial: boolean;
  allow_redistribution: boolean;
  published_at: string;
  updated_at: string;
  creator_id: string;
};

type ListResult = {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Fetch published products for the store grid.
 *
 * Defense in depth:
 *   - RLS already restricts to status='published' for anon/auth visitors,
 *     but we still .eq('status', 'published') in the query so the intent
 *     is readable and the behavior is correct even if RLS were relaxed.
 *   - Ordering by published_at + created_at gives a stable order across
 *     pages (no flicker if two rows share a published_at).
 *   - file_path is never SELECT-ed.
 */
export type StoreSort = "published" | "rating";

export async function listPublishedProducts(opts?: {
  category?: ProductType | null;
  tag?: string | null;
  page?: number;
  sort?: StoreSort;
}): Promise<ListResult> {
  const supabase = createClient();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = STORE_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sort: StoreSort = opts?.sort ?? "published";

  // タグフィルタが指定されている場合: 先に product_tags から該当 tag の
  // product_id を全部取り、products を .in() で絞り込む。
  // tag を含む products が 0 件なら早期 return(空ページ)。
  let tagFilteredIds: string[] | null = null;
  if (opts?.tag) {
    const { data: tagRows, error: tagErr } = await supabase
      .from("product_tags")
      .select("product_id")
      .eq("tag", opts.tag);

    if (tagErr) {
      console.error("[listPublishedProducts] tag filter failed", tagErr);
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }
    tagFilteredIds = Array.from(
      new Set((tagRows ?? []).map((r) => r.product_id)),
    );
    if (tagFilteredIds.length === 0) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }
  }

  // ----- rating sort: JS 側で集計してから page 範囲を切る -----
  // 全 published products(category / tag フィルタ適用済)を slim 列で
  // 取得 → review 集計 → 並び替え → page slice → その ids で fullfetch。
  if (sort === "rating") {
    return listByRating({
      page,
      pageSize,
      category: opts?.category ?? null,
      tagFilteredIds,
    });
  }

  let query = supabase
    .from("products")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (opts?.category) {
    query = query.eq("product_type", opts.category);
  }
  if (tagFilteredIds) {
    query = query.in("id", tagFilteredIds);
  }

  const { data: rows, count, error } = await query;
  if (error) {
    console.error("[listPublishedProducts] failed", error);
    return { items: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const creatorIds = Array.from(new Set((rows ?? []).map((r) => r.creator_id)));
  const productIds = (rows ?? []).map((r) => r.id);
  // creators / reviews を並行 fetch(両者は独立)
  const [creators, reviewSummaries] = await Promise.all([
    fetchPublicProfiles(creatorIds),
    fetchReviewSummariesByProductIds(productIds),
  ]);

  const items: ProductListItem[] = (rows ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    productType: r.product_type as ProductType,
    priceJpy: r.price_jpy,
    coverPath: r.cover_path,
    systemLabel: r.system_label,
    publishedAt: r.published_at,
    creator: {
      id: r.creator_id,
      displayName: creators.get(r.creator_id)?.displayName ?? "",
      avatarPath: creators.get(r.creator_id)?.avatarPath ?? null,
    },
    reviewSummary: reviewSummaries.get(r.id) ?? null,
  }));

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return { items, total, page, pageSize, totalPages };
}

/**
 * ホーム最上部の Steam ライク大型カルーセル用。売上上位 + 好評 を
 * 組合せて重複排除し、最上位 N 件を返す。両方とも 0 件のときは
 * 新着 fallback。
 *
 * 「フィーチャー」= 売上 / 評価で「目を引く」候補。実購入ゼロ環境
 * でも新着で carousel は描画される(空 hero になるのを防ぐ)。
 */
export async function listFeaturedProducts(
  limit: number = 8,
): Promise<ProductListItem[]> {
  const [topSellers, topRated] = await Promise.all([
    listTopSellingProducts(limit),
    listTopRatedProducts(limit),
  ]);

  // 売上 → 評価の順で merge、重複排除
  const seen = new Set<string>();
  const merged: ProductListItem[] = [];
  for (const p of [...topSellers, ...topRated]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    merged.push(p);
    if (merged.length >= limit) break;
  }

  // 上 2 つで limit に満たないときだけ新着で補完(α 初期向け)
  if (merged.length < limit) {
    const recent = await listRecentProducts(limit);
    for (const p of recent) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
      if (merged.length >= limit) break;
    }
  }

  return merged;
}

/**
 * ホームの「好評な作品」strip 用。listPublishedProducts({sort:"rating"}) を
 * 1 ページ分(STORE_PAGE_SIZE=12 件)取り、評価のある作品が含まれている
 * 場合のみ items を返す。
 *
 * 評価ゼロのときは strip 自体を出したくないため、ホーム側で「0 件なら
 * 非表示」を判定できるように空配列を返す(売上上位 strip と同じ規約)。
 */
export async function listTopRatedProducts(
  limit: number = 12,
): Promise<ProductListItem[]> {
  const result = await listPublishedProducts({
    sort: "rating",
    page: 1,
  });
  const items = result.items.slice(0, limit);

  // 評価のある作品が 1 件もないなら、好評順 = 新着順と同等になるので
  // strip を出す意味がない。空配列を返してホーム側で非表示にする。
  const hasAnyRating = items.some(
    (it) => it.reviewSummary && it.reviewSummary.total > 0,
  );
  return hasAnyRating ? items : [];
}

/**
 * 「好評順」ソート用の内部ヘルパ。
 *
 * 集計手順:
 *   1. tag / category 適用済の全 published products の id + published_at を取得
 *   2. 該当 ids の product_reviews を一括 fetch、product 別の (positive, total) を集計
 *   3. JS で並び替え:
 *      - positive ratio desc
 *      - tie: positive count desc(同率なら件数が多い方を上に)
 *      - tie: published_at desc(さらに同じなら新着)
 *      - 評価 0 件作品はすべて末尾に published_at desc で並ぶ
 *   4. page 範囲を slice
 *   5. その ids で LIST_COLUMNS を select → 順序を保ちつつ整形
 *   6. items に reviewSummary を inject(別の集計が走らないよう手元で構築)
 *
 * 規模注意: α 期間は問題ないが、数千件を超えたら RPC + materialized view へ。
 */
async function listByRating(args: {
  page: number;
  pageSize: number;
  category: ProductType | null;
  tagFilteredIds: string[] | null;
}): Promise<ListResult> {
  const { page, pageSize, category, tagFilteredIds } = args;
  const supabase = createClient();

  // Step 1: 全 published products(filter 適用済)を slim select
  let idQuery = supabase
    .from("products")
    .select("id, published_at")
    .eq("status", "published")
    .limit(5000);
  if (category) idQuery = idQuery.eq("product_type", category);
  if (tagFilteredIds) idQuery = idQuery.in("id", tagFilteredIds);

  const { data: idRows, error: idErr } = await idQuery;
  if (idErr) {
    console.error("[listByRating] id query failed", idErr);
    return { items: [], total: 0, page, pageSize, totalPages: 0 };
  }

  if (!idRows || idRows.length === 0) {
    return { items: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const allIds = idRows.map((r) => r.id);
  const publishedMap = new Map(
    idRows.map((r) => [r.id, r.published_at] as const),
  );

  // Step 2: review summary を一括取得
  const reviewMap = await fetchReviewSummariesByProductIds(allIds);

  // Step 3: 並び替え
  const sortedIds = [...allIds].sort((a, b) => {
    const ra = reviewMap.get(a);
    const rb = reviewMap.get(b);
    const ratioA = ra && ra.total > 0 ? ra.positive / ra.total : -1;
    const ratioB = rb && rb.total > 0 ? rb.positive / rb.total : -1;
    if (ratioA !== ratioB) return ratioB - ratioA;
    const countA = ra?.positive ?? 0;
    const countB = rb?.positive ?? 0;
    if (countA !== countB) return countB - countA;
    // published_at desc(新しい順を最後の tiebreak に)
    return (publishedMap.get(b) ?? "").localeCompare(
      publishedMap.get(a) ?? "",
    );
  });

  const total = sortedIds.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  const pageIds = sortedIds.slice(from, to);

  if (pageIds.length === 0) {
    return { items: [], total, page, pageSize, totalPages };
  }

  // Step 4: 必要な page 分だけ full select
  const { data: fullRows, error: fullErr } = await supabase
    .from("products")
    .select(LIST_COLUMNS)
    .in("id", pageIds);

  if (fullErr) {
    console.error("[listByRating] full select failed", fullErr);
    return { items: [], total, page, pageSize, totalPages };
  }

  const byId = new Map((fullRows ?? []).map((r) => [r.id, r] as const));
  const orderedRows = pageIds
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  // Step 5: creator 一括取得(reviews は手元の reviewMap を再利用)
  const creatorIds = Array.from(
    new Set(orderedRows.map((r) => r.creator_id)),
  );
  const creators = await fetchPublicProfiles(creatorIds);

  const items: ProductListItem[] = orderedRows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    productType: r.product_type as ProductType,
    priceJpy: r.price_jpy,
    coverPath: r.cover_path,
    systemLabel: r.system_label,
    publishedAt: r.published_at,
    creator: {
      id: r.creator_id,
      displayName: creators.get(r.creator_id)?.displayName ?? "",
      avatarPath: creators.get(r.creator_id)?.avatarPath ?? null,
    },
    reviewSummary: reviewMap.get(r.id) ?? null,
  }));

  return { items, total, page, pageSize, totalPages };
}

/**
 * Fetch a single published product by slug, with tags and creator profile.
 * Returns null when not found OR not published (caller should call notFound()).
 */
export async function getPublishedProductBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  const supabase = createClient();

  const { data: row, error } = await supabase
    .from("products")
    .select(DETAIL_COLUMNS)
    .eq("status", "published")
    .eq("slug", slug)
    .returns<ProductDetailRow[]>()
    .maybeSingle();

  if (error || !row) {
    if (error) console.error("[getPublishedProductBySlug] failed", error);
    return null;
  }

  const [tags, creators] = await Promise.all([
    fetchTags(row.id),
    fetchPublicProfiles([row.creator_id]),
  ]);

  const creator = creators.get(row.creator_id);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    productType: row.product_type as ProductType,
    fileFormat: row.file_format as FileFormat,
    priceJpy: row.price_jpy,
    coverPath: row.cover_path,
    systemLabel: row.system_label,
    players: row.players,
    playtime: row.playtime,
    recommendedSkills: row.recommended_skills,
    allowCommercial: row.allow_commercial,
    allowRedistribution: row.allow_redistribution,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    tags,
    creator: {
      id: row.creator_id,
      displayName: creator?.displayName ?? "",
      avatarPath: creator?.avatarPath ?? null,
      bio: creator?.bio ?? "",
    },
  };
}

/**
 * Fetch the most recently published products (for "新着" strip).
 * Limited list, no pagination.
 */
export async function listRecentProducts(
  limit = 12,
): Promise<ProductListItem[]> {
  const supabase = createClient();

  const { data: rows, error } = await supabase
    .from("products")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[listRecentProducts] failed", error);
    return [];
  }

  return toProductListItems(rows ?? []);
}

/**
 * Fetch the top-selling products by paid purchase count (for "売上上位" strip).
 *
 * α 期間中のシンプル実装:
 *   1. paid purchases を全件 SELECT(product_id のみ)
 *   2. JS 側で product_id 単位に集計
 *   3. count desc で上位 N 件の product_id を選別
 *   4. その ID 群で products を fetch
 *
 * 実購入が無いうちは listRecentProducts に fallback する。
 *
 * 規模注意:purchases が数千件を超えるようになったら Postgres 関数 / 集計
 * テーブルに置き換える(B-XX として将来課題)。α 期間中は問題なし。
 */
export async function listTopSellingProducts(
  limit = 12,
): Promise<ProductListItem[]> {
  const supabase = createClient();

  const { data: purchases, error: purchaseErr } = await supabase
    .from("purchases")
    .select("product_id")
    .eq("status", "paid");

  if (purchaseErr) {
    console.error("[listTopSellingProducts] purchases failed", purchaseErr);
    return listRecentProducts(limit);
  }

  if (!purchases || purchases.length === 0) {
    // 実購入ゼロ → 新着で代替
    return listRecentProducts(limit);
  }

  // JS 側で count
  const counts = new Map<string, number>();
  for (const p of purchases) {
    counts.set(p.product_id, (counts.get(p.product_id) ?? 0) + 1);
  }

  const topIds = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (topIds.length === 0) {
    return listRecentProducts(limit);
  }

  const { data: rows, error: prodErr } = await supabase
    .from("products")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .in("id", topIds);

  if (prodErr) {
    console.error("[listTopSellingProducts] products failed", prodErr);
    return [];
  }

  // count 降順を維持するよう、id 順を topIds に合わせて並べ直し
  const byId = new Map((rows ?? []).map((r) => [r.id, r] as const));
  const sortedRows = topIds
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  return toProductListItems(sortedRows);
}

/**
 * 同じクリエイターの他作品を取得。商品詳細ページの「○○ の他の作品」
 * strip 用。
 *
 * 並び順は publish 日新しい順、limit 件まで。`excludeId` を指定すると
 * その作品自身を除外する(本商品を一覧から外す用途)。0 件のときは
 * 呼び出し側でセクション非表示にする想定。
 */
export async function listProductsByCreator(args: {
  creatorId: string;
  excludeId?: string;
  limit?: number;
}): Promise<ProductListItem[]> {
  const supabase = createClient();
  const limit = args.limit ?? 6;

  let query = supabase
    .from("products")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .eq("creator_id", args.creatorId)
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (args.excludeId) {
    query = query.neq("id", args.excludeId);
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error("[listProductsByCreator] failed", error);
    return [];
  }

  return toProductListItems(rows ?? []);
}

/**
 * Fetch related products (same product_type, excluding the given product).
 * 商品詳細ページの「関連作品」strip 用。
 *
 * 並び順は publish 日新しい順、limit 件まで。表示する側で 0 件の場合は
 * セクション自体を非表示にする想定。
 */
export async function listRelatedProducts(args: {
  productType: ProductType;
  excludeId: string;
  limit?: number;
}): Promise<ProductListItem[]> {
  const supabase = createClient();
  const limit = args.limit ?? 6;

  const { data: rows, error } = await supabase
    .from("products")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .eq("product_type", args.productType)
    .neq("id", args.excludeId)
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[listRelatedProducts] failed", error);
    return [];
  }

  return toProductListItems(rows ?? []);
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

/**
 * 行配列を ProductListItem 配列に変換。creator 名は public_profiles から
 * 一括取得して付与する。listPublishedProducts と同じ整形ロジックを
 * 切り出したもの。
 */
async function toProductListItems(
  rows: Array<{
    id: string;
    slug: string;
    title: string;
    product_type: string;
    price_jpy: number;
    cover_path: string | null;
    system_label: string | null;
    published_at: string;
    creator_id: string;
  }>,
): Promise<ProductListItem[]> {
  const creatorIds = Array.from(new Set(rows.map((r) => r.creator_id)));
  const productIds = rows.map((r) => r.id);
  // creators / reviews 並行 fetch
  const [creators, reviewSummaries] = await Promise.all([
    fetchPublicProfiles(creatorIds),
    fetchReviewSummariesByProductIds(productIds),
  ]);

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    productType: r.product_type as ProductType,
    priceJpy: r.price_jpy,
    coverPath: r.cover_path,
    systemLabel: r.system_label,
    publishedAt: r.published_at,
    creator: {
      id: r.creator_id,
      displayName: creators.get(r.creator_id)?.displayName ?? "",
      avatarPath: creators.get(r.creator_id)?.avatarPath ?? null,
    },
    reviewSummary: reviewSummaries.get(r.id) ?? null,
  }));
}

type PublicProfileRow = {
  displayName: string;
  avatarPath: string | null;
  bio: string;
  twitterHandle: string;
  websiteUrl: string;
};

async function fetchPublicProfiles(
  ids: string[],
): Promise<Map<string, PublicProfileRow>> {
  const result = new Map<string, PublicProfileRow>();
  if (ids.length === 0) return result;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, display_name, avatar_path, bio, twitter_handle, website_url")
    .in("id", ids);

  if (error) {
    console.error("[fetchPublicProfiles] failed", error);
    return result;
  }

  for (const row of data ?? []) {
    result.set(row.id, {
      displayName: row.display_name ?? "",
      avatarPath: row.avatar_path,
      bio: row.bio ?? "",
      twitterHandle: row.twitter_handle ?? "",
      websiteUrl: row.website_url ?? "",
    });
  }
  return result;
}

async function fetchTags(productId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_tags")
    .select("tag")
    .eq("product_id", productId);

  if (error) {
    console.error("[fetchTags] failed", error);
    return [];
  }
  return (data ?? []).map((r) => r.tag);
}
