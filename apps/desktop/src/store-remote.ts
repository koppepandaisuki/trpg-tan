import { supabase } from "./supabase";
import type { RemoteProductType, RemoteFileFormat } from "./library-remote";

/**
 * ストア(公開作品の閲覧)のデータ層。Web の lib/queries/products.ts /
 * reviews.ts をデスクトップへ移植したもの。
 *
 *  - 公開作品 / プロフィール / レビュー / タグ / スクショは RLS で
 *    匿名でも読めるため、未ログインでも閲覧できる
 *  - covers / avatars / screenshots は公開バケット → getPublicUrl で URL 化
 *  - file_path は決して SELECT しない(Web と同じ防御)
 *  - 決済は Web(Stripe)に集約。アプリからは商品ページをブラウザで開く
 */

export const STORE_PAGE_SIZE = 24;

export type StoreSort = "published" | "rating" | "price_asc" | "price_desc";

/** 価格帯フィルタ(定価ベース。web の StorePriceFilter と同じ区分)。 */
export type StorePriceBand = "free" | "u500" | "mid" | "o1000";

export type ReviewLabel =
  | "圧倒的に好評"
  | "非常に好評"
  | "ほぼ好評"
  | "賛否両論"
  | "やや不評"
  | "不評"
  | "圧倒的に不評"
  | "評価不足"
  | "評価なし";

export interface StoreReviewSummary {
  total: number;
  positive: number;
  /** 平均星(1–5)。レビュー 0 件のときは 0。*/
  avgStars: number;
  label: ReviewLabel;
}

export interface StoreItem {
  id: string;
  slug: string;
  title: string;
  productType: RemoteProductType;
  priceJpy: number;
  /** 割引率(0..100)。100 = 無料配布。実効価格は salePriceJpy() で算出。*/
  discountPercent: number;
  /** セール開始/終了(ISO)。null は無期限。期間内のみ割引が有効。*/
  discountStartsAt: string | null;
  discountEndsAt: string | null;
  coverUrl: string | null;
  systemLabel: string | null;
  publishedAt: string;
  creator: { id: string; displayName: string; avatarUrl: string | null };
  review: StoreReviewSummary | null;
}

export interface StoreReview {
  id: string;
  /** 5 段階の星評価(1..5)。*/
  stars: number;
  rating: "positive" | "negative";
  comment: string;
  createdAt: string;
  user: { displayName: string; avatarUrl: string | null };
  reply: { body: string; creatorName: string } | null;
  helpfulCount: number;
}

export interface StoreDetail extends StoreItem {
  description: string;
  fileFormat: RemoteFileFormat;
  players: string | null;
  playtime: string | null;
  recommendedSkills: string | null;
  allowCommercial: boolean;
  allowRedistribution: boolean;
  updatedAt: string;
  tags: string[];
  screenshotUrls: string[];
  creatorBio: string;
  reviews: StoreReview[];
}

export interface StoreListResult {
  items: StoreItem[];
  total: number;
  page: number;
  totalPages: number;
}

/* ===== Storage URL ===== */

function coverUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
}
function avatarUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
function screenshotUrl(path: string): string {
  return supabase.storage.from("screenshots").getPublicUrl(path).data.publicUrl;
}

/* ===== 集計(Web の computeReviewLabel と同一基準) ===== */

/** 後方互換: 旧 rating しか無い行の星フォールバック。*/
function starsOf(row: { stars: number | null; rating: string }): number {
  if (typeof row.stars === "number" && row.stars >= 1 && row.stars <= 5) {
    return row.stars;
  }
  return row.rating === "positive" ? 5 : 2;
}

/** 平均星(1–5)から Steam 風の総合評価ラベルを算出(web と同基準)。*/
function computeStarLabel(avgStars: number, total: number): ReviewLabel {
  if (total === 0) return "評価なし";
  if (total < 3) return "評価不足";
  if (avgStars >= 4.5) return "圧倒的に好評";
  if (avgStars >= 4.0) return "非常に好評";
  if (avgStars >= 3.5) return "ほぼ好評";
  if (avgStars >= 2.5) return "賛否両論";
  if (avgStars >= 2.0) return "やや不評";
  if (avgStars >= 1.5) return "不評";
  return "圧倒的に不評";
}

async function fetchReviewSummaries(
  productIds: string[],
): Promise<Map<string, StoreReviewSummary>> {
  const result = new Map<string, StoreReviewSummary>();
  if (productIds.length === 0) return result;
  const { data, error } = await supabase
    .from("product_reviews")
    .select("product_id, stars, rating")
    .in("product_id", productIds);
  if (error) return result;

  const counts = new Map<
    string,
    { positive: number; total: number; starSum: number }
  >();
  for (const row of data ?? []) {
    const c = counts.get(row.product_id) ?? {
      positive: 0,
      total: 0,
      starSum: 0,
    };
    const s = starsOf(row);
    c.total++;
    c.starSum += s;
    if (s >= 4) c.positive++;
    counts.set(row.product_id, c);
  }
  for (const [id, c] of counts.entries()) {
    const avgStars = c.total === 0 ? 0 : c.starSum / c.total;
    result.set(id, {
      total: c.total,
      positive: c.positive,
      avgStars,
      label: computeStarLabel(avgStars, c.total),
    });
  }
  return result;
}

type ProfileLite = { displayName: string; avatarUrl: string | null; bio: string };

async function fetchProfiles(ids: string[]): Promise<Map<string, ProfileLite>> {
  const result = new Map<string, ProfileLite>();
  if (ids.length === 0) return result;
  const { data } = await supabase
    .from("public_profiles")
    .select("id, display_name, avatar_path, bio")
    .in("id", ids);
  for (const row of data ?? []) {
    result.set(row.id, {
      displayName: row.display_name ?? "",
      avatarUrl: avatarUrl(row.avatar_path),
      bio: row.bio ?? "",
    });
  }
  return result;
}

const LIST_COLUMNS =
  "id, slug, title, product_type, price_jpy, discount_percent, discount_starts_at, discount_ends_at, cover_path, system_label, published_at, creator_id";

type ListRow = {
  id: string;
  slug: string;
  title: string;
  product_type: string;
  price_jpy: number;
  discount_percent: number;
  discount_starts_at: string | null;
  discount_ends_at: string | null;
  cover_path: string | null;
  system_label: string | null;
  published_at: string;
  creator_id: string;
};

async function toStoreItems(rows: ListRow[]): Promise<StoreItem[]> {
  const creatorIds = Array.from(new Set(rows.map((r) => r.creator_id)));
  const [profiles, reviews] = await Promise.all([
    fetchProfiles(creatorIds),
    fetchReviewSummaries(rows.map((r) => r.id)),
  ]);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    productType: r.product_type as RemoteProductType,
    priceJpy: r.price_jpy,
    discountPercent: r.discount_percent ?? 0,
    discountStartsAt: r.discount_starts_at ?? null,
    discountEndsAt: r.discount_ends_at ?? null,
    coverUrl: coverUrl(r.cover_path),
    systemLabel: r.system_label,
    publishedAt: r.published_at,
    creator: {
      id: r.creator_id,
      displayName: profiles.get(r.creator_id)?.displayName ?? "",
      avatarUrl: profiles.get(r.creator_id)?.avatarUrl ?? null,
    },
    review: reviews.get(r.id) ?? null,
  }));
}

/** 検索語にマッチする published product の id 集合(タイトル/作者名/タグ)。 */
async function resolveSearchIds(q: string): Promise<string[]> {
  const pattern = `%${q}%`;
  const ids = new Set<string>();

  const { data: byTitle } = await supabase
    .from("products")
    .select("id")
    .eq("status", "published")
    .ilike("title", pattern)
    .limit(5000);
  for (const r of byTitle ?? []) ids.add(r.id);

  const { data: profileRows } = await supabase
    .from("public_profiles")
    .select("id")
    .ilike("display_name", pattern)
    .limit(1000);
  const creatorIds = (profileRows ?? []).map((r) => r.id);
  if (creatorIds.length > 0) {
    const { data: byCreator } = await supabase
      .from("products")
      .select("id")
      .eq("status", "published")
      .in("creator_id", creatorIds)
      .limit(5000);
    for (const r of byCreator ?? []) ids.add(r.id);
  }

  const { data: byTag } = await supabase
    .from("product_tags")
    .select("product_id")
    .ilike("tag", pattern)
    .limit(5000);
  for (const r of byTag ?? []) ids.add(r.product_id);

  return Array.from(ids);
}

/** ストア一覧(カテゴリ / 検索 / 作者 / 並び順 / ページ)。 */
export type StoreFilterOpts = {
  category?: RemoteProductType | null;
  /** 複数カテゴリ(グループ絞り込み: 素材=map+bgm_audio 等)。category より優先。 */
  categories?: RemoteProductType[] | null;
  q?: string | null;
  /** 作品名のみの絞り込み(右サイドバーの名前検索。q とは AND)。 */
  titleQ?: string | null;
  creatorId?: string | null;
  /** フォロー中クリエイター絞り込み(ローカル保存の id 群)。 */
  creatorIds?: string[] | null;
  /** ウィッシュリスト絞り込み(ローカル保存の id 群)。 */
  onlyIds?: string[] | null;
  priceBand?: StorePriceBand | null;
  /** 「今」セール中(discount_percent>0 かつ期間内)のみ。 */
  saleOnly?: boolean;
  sort?: StoreSort;
  page?: number;
};

/** 共通フィルタを PostgREST クエリへ適用(published / rating 両経路で共用)。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyStoreFilters<T extends any>(query: T, opts: StoreFilterOpts): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;
  const cats =
    opts.categories && opts.categories.length > 0
      ? opts.categories
      : opts.category
        ? [opts.category]
        : null;
  if (cats) q = cats.length === 1 ? q.eq("product_type", cats[0]) : q.in("product_type", cats);
  if (opts.creatorId) q = q.eq("creator_id", opts.creatorId);
  if (opts.creatorIds) {
    // 空配列 = フォローが無い: 全件ではなく 0 件にする(onlyIds と同じ流儀)。
    q = q.in("creator_id", opts.creatorIds.length > 0 ? opts.creatorIds : ["-"]);
  }
  if (opts.titleQ?.trim()) {
    // % と _ は LIKE のワイルドカードなのでエスケープ。
    const esc = opts.titleQ.trim().replace(/[%_]/g, (m) => `\\${m}`);
    q = q.ilike("title", `%${esc}%`);
  }
  if (opts.onlyIds) {
    q = q.in("id", opts.onlyIds.length > 0 ? opts.onlyIds : ["-"]);
  }
  if (opts.priceBand) {
    switch (opts.priceBand) {
      case "free":
        q = q.eq("price_jpy", 0);
        break;
      case "u500":
        q = q.gte("price_jpy", 1).lte("price_jpy", 500);
        break;
      case "mid":
        q = q.gte("price_jpy", 501).lte("price_jpy", 1000);
        break;
      case "o1000":
        q = q.gte("price_jpy", 1001);
        break;
    }
  }
  if (opts.saleOnly) {
    const now = new Date().toISOString();
    // 複数の .or() は AND で結合される: 率>0 AND (開始null or 開始<=now) AND (終了null or 終了>=now)
    q = q
      .gt("discount_percent", 0)
      .or(`discount_starts_at.is.null,discount_starts_at.lte.${now}`)
      .or(`discount_ends_at.is.null,discount_ends_at.gte.${now}`);
  }
  return q as T;
}

export async function fetchStore(opts: StoreFilterOpts): Promise<StoreListResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = STORE_PAGE_SIZE;
  const sort = opts.sort ?? "published";
  const q = opts.q?.trim() || null;

  let searchIds: string[] | null = null;
  if (q) {
    searchIds = await resolveSearchIds(q);
    if (searchIds.length === 0) {
      return { items: [], total: 0, page, totalPages: 0 };
    }
  }

  if (sort === "rating") {
    return fetchByRating({ page, pageSize, searchIds, opts });
  }

  const from = (page - 1) * pageSize;
  let query = supabase
    .from("products")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("status", "published");
  if (sort === "price_asc" || sort === "price_desc") {
    query = query
      .order("price_jpy", { ascending: sort === "price_asc" })
      .order("published_at", { ascending: false });
  } else {
    query = query
      .order("published_at", { ascending: false })
      .order("created_at", { ascending: false });
  }
  query = query.range(from, from + pageSize - 1);
  query = applyStoreFilters(query, opts);
  if (searchIds !== null) query = query.in("id", searchIds);

  const { data: rows, count, error } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    items: await toStoreItems((rows ?? []) as ListRow[]),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** 類似品(同カテゴリの好評順、自身を除く)。詳細ページ下部のレール用。 */
export async function fetchSimilarItems(
  productType: RemoteProductType,
  excludeId: string,
  limit = 8,
): Promise<StoreItem[]> {
  const res = await fetchByRating({
    page: 1,
    pageSize: limit + 1, // 自身が混ざる分を見込んで 1 つ多めに取る
    searchIds: null,
    opts: { category: productType },
  });
  return res.items.filter((it) => it.id !== excludeId).slice(0, limit);
}

/** 好評順ソート(Web の listByRating と同じ手順を JS 集計で)。 */
async function fetchByRating(args: {
  page: number;
  pageSize: number;
  searchIds: string[] | null;
  opts: StoreFilterOpts;
}): Promise<StoreListResult> {
  const { page, pageSize, searchIds } = args;

  let idQuery = supabase
    .from("products")
    .select("id, published_at")
    .eq("status", "published")
    .limit(5000);
  idQuery = applyStoreFilters(idQuery, args.opts);
  if (searchIds !== null) idQuery = idQuery.in("id", searchIds);

  const { data: idRows, error } = await idQuery;
  if (error) throw new Error(error.message);
  if (!idRows || idRows.length === 0) {
    return { items: [], total: 0, page, totalPages: 0 };
  }

  const allIds = idRows.map((r) => r.id);
  const publishedMap = new Map(idRows.map((r) => [r.id, r.published_at] as const));
  const reviewMap = await fetchReviewSummaries(allIds);

  const sorted = [...allIds].sort((a, b) => {
    const ra = reviewMap.get(a);
    const rb = reviewMap.get(b);
    const starA = ra && ra.total > 0 ? ra.avgStars : -1;
    const starB = rb && rb.total > 0 ? rb.avgStars : -1;
    if (starA !== starB) return starB - starA;
    const countA = ra?.total ?? 0;
    const countB = rb?.total ?? 0;
    if (countA !== countB) return countB - countA;
    return (publishedMap.get(b) ?? "").localeCompare(publishedMap.get(a) ?? "");
  });

  const total = sorted.length;
  const pageIds = sorted.slice((page - 1) * pageSize, page * pageSize);
  if (pageIds.length === 0) {
    return { items: [], total, page, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  const { data: rows, error: rowErr } = await supabase
    .from("products")
    .select(LIST_COLUMNS)
    .in("id", pageIds);
  if (rowErr) throw new Error(rowErr.message);

  const byId = new Map(((rows ?? []) as ListRow[]).map((r) => [r.id, r] as const));
  const ordered = pageIds
    .map((id) => byId.get(id))
    .filter((r): r is ListRow => Boolean(r));

  return {
    items: await toStoreItems(ordered),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** 商品詳細(タグ / スクショ / レビュー込み)。非公開なら null。 */
export async function fetchStoreDetail(
  productId: string,
): Promise<StoreDetail | null> {
  const { data: row, error } = await supabase
    .from("products")
    .select(
      [
        "id",
        "slug",
        "title",
        "description",
        "product_type",
        "file_format",
        "price_jpy",
        "discount_percent",
        "discount_starts_at",
        "discount_ends_at",
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
      ].join(", "),
    )
    .eq("status", "published")
    .eq("id", productId)
    .maybeSingle<{
      id: string;
      slug: string;
      title: string;
      description: string;
      product_type: string;
      file_format: string;
      price_jpy: number;
      discount_percent: number;
      discount_starts_at: string | null;
      discount_ends_at: string | null;
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
    }>();
  if (error || !row) return null;

  const [tags, shots, profiles, reviews, summaries] = await Promise.all([
    supabase.from("product_tags").select("tag").eq("product_id", row.id),
    supabase
      .from("product_screenshots")
      .select("path, order_index")
      .eq("product_id", row.id)
      .order("order_index", { ascending: true }),
    fetchProfiles([row.creator_id]),
    fetchReviews(row.id),
    fetchReviewSummaries([row.id]),
  ]);

  const profile = profiles.get(row.creator_id);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? "",
    productType: row.product_type as RemoteProductType,
    fileFormat: row.file_format as RemoteFileFormat,
    priceJpy: row.price_jpy,
    discountPercent: row.discount_percent ?? 0,
    discountStartsAt: row.discount_starts_at ?? null,
    discountEndsAt: row.discount_ends_at ?? null,
    coverUrl: coverUrl(row.cover_path),
    systemLabel: row.system_label,
    players: row.players,
    playtime: row.playtime,
    recommendedSkills: row.recommended_skills,
    allowCommercial: row.allow_commercial,
    allowRedistribution: row.allow_redistribution,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    creator: {
      id: row.creator_id,
      displayName: profile?.displayName ?? "",
      avatarUrl: profile?.avatarUrl ?? null,
    },
    creatorBio: profile?.bio ?? "",
    tags: (tags.data ?? []).map((t) => t.tag),
    screenshotUrls: (shots.data ?? []).map((s) => screenshotUrl(s.path)),
    review: summaries.get(row.id) ?? null,
    reviews,
  };
}

/** 商品のレビュー一覧(新しい順。返信 / 役に立った数つき)。 */
async function fetchReviews(productId: string): Promise<StoreReview[]> {
  const { data: rows, error } = await supabase
    .from("product_reviews")
    .select("id, user_id, stars, rating, comment, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error || !rows || rows.length === 0) return [];

  const reviewIds = rows.map((r) => r.id);
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

  const [profiles, replyRes, voteRes] = await Promise.all([
    fetchProfiles(userIds),
    supabase
      .from("review_replies")
      .select("review_id, creator_id, body")
      .in("review_id", reviewIds),
    supabase.from("review_votes").select("review_id").in("review_id", reviewIds),
  ]);

  // 返信者(creator)のプロフィールも追加で引く。
  const replyRows = replyRes.data ?? [];
  const replyCreatorIds = Array.from(new Set(replyRows.map((r) => r.creator_id)));
  const replyProfiles = await fetchProfiles(
    replyCreatorIds.filter((id) => !profiles.has(id)),
  );
  const nameOf = (id: string) =>
    profiles.get(id)?.displayName ?? replyProfiles.get(id)?.displayName ?? "";

  const replyMap = new Map(
    replyRows.map((r) => [
      r.review_id,
      { body: r.body ?? "", creatorName: nameOf(r.creator_id) },
    ]),
  );
  const voteCounts = new Map<string, number>();
  for (const v of voteRes.data ?? []) {
    voteCounts.set(v.review_id, (voteCounts.get(v.review_id) ?? 0) + 1);
  }

  return rows.map((r) => ({
    id: r.id,
    stars: starsOf(r),
    rating: r.rating as "positive" | "negative",
    comment: r.comment ?? "",
    createdAt: r.created_at,
    user: {
      displayName: profiles.get(r.user_id)?.displayName ?? "",
      avatarUrl: profiles.get(r.user_id)?.avatarUrl ?? null,
    },
    reply: replyMap.get(r.id) ?? null,
    helpfulCount: voteCounts.get(r.id) ?? 0,
  }));
}

/* ===== ホーム(Steam ライクなフロントページ)用フェッチャ ===== */

/** 新着(published_at 降順)。 */
async function fetchRecentItems(limit: number): Promise<StoreItem[]> {
  const { data, error } = await supabase
    .from("products")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return toStoreItems((data ?? []) as ListRow[]);
}

/**
 * 売上上位。purchases は RLS で「自分の購入」しか見えないため、
 * 取れた範囲で集計し、0 件なら空(呼び出し側が新着等で補完)。
 */
async function fetchTopSellingItems(limit: number): Promise<StoreItem[]> {
  const { data, error } = await supabase
    .from("purchases")
    .select("product_id")
    .eq("status", "paid")
    .limit(5000);
  if (error || !data || data.length === 0) return [];

  const counts = new Map<string, number>();
  for (const p of data) counts.set(p.product_id, (counts.get(p.product_id) ?? 0) + 1);
  const topIds = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  const { data: rows, error: rowErr } = await supabase
    .from("products")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .in("id", topIds);
  if (rowErr) return [];
  const byId = new Map(((rows ?? []) as ListRow[]).map((r) => [r.id, r] as const));
  const ordered = topIds.map((id) => byId.get(id)).filter((r): r is ListRow => !!r);
  return toStoreItems(ordered);
}

/** 好評上位。評価が 1 件もなければ空(セクション非表示用)。 */
export async function fetchTopRatedItems(limit: number): Promise<StoreItem[]> {
  const res = await fetchByRating({
    page: 1,
    pageSize: limit,
    searchIds: null,
    opts: {},
  });
  const hasRating = res.items.some((it) => it.review && it.review.total > 0);
  return hasRating ? res.items : [];
}

/**
 * 急上昇 = 直近 30 日のレビュー数が多い順(レビューは公開データなので
 * 匿名でも集計できる)。0 件ならセクション非表示。
 */
async function fetchTrendingItems(limit: number): Promise<StoreItem[]> {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("product_reviews")
    .select("product_id, created_at")
    .gte("created_at", since)
    .limit(5000);
  if (error || !data || data.length === 0) return [];

  const counts = new Map<string, number>();
  for (const r of data) counts.set(r.product_id, (counts.get(r.product_id) ?? 0) + 1);
  const topIds = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  const { data: rows, error: rowErr } = await supabase
    .from("products")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .in("id", topIds);
  if (rowErr) return [];
  const byId = new Map(((rows ?? []) as ListRow[]).map((r) => [r.id, r] as const));
  const ordered = topIds.map((id) => byId.get(id)).filter((r): r is ListRow => !!r);
  return toStoreItems(ordered);
}

/** カルーセル用: StoreItem + スクリーンショット(右パネルのサムネ)。 */
export type FeaturedItem = StoreItem & { screens: string[] };

/**
 * フィーチャー(カルーセル用): 売上上位 + 好評上位を merge し、足りない分は
 * 新着で補完(Web の listFeaturedProducts と同じ規約)。選ばれた作品の
 * スクリーンショットを一括で引いて添える(Steam の「注目&おすすめ」右パネル)。
 */
async function fetchFeaturedItems(limit: number): Promise<FeaturedItem[]> {
  const [selling, rated] = await Promise.all([
    fetchTopSellingItems(limit),
    fetchTopRatedItems(limit),
  ]);
  const seen = new Set<string>();
  const merged: StoreItem[] = [];
  for (const it of [...selling, ...rated]) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    merged.push(it);
    if (merged.length >= limit) break;
  }
  if (merged.length < limit) {
    const recent = await fetchRecentItems(limit * 2);
    for (const it of recent) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      merged.push(it);
      if (merged.length >= limit) break;
    }
  }
  if (merged.length === 0) return [];

  // スクリーンショットを一括取得して各作品に最大 4 枚添付。
  const { data: shotRows } = await supabase
    .from("product_screenshots")
    .select("product_id, path, order_index")
    .in(
      "product_id",
      merged.map((it) => it.id),
    )
    .order("order_index", { ascending: true });
  const shotMap = new Map<string, string[]>();
  for (const row of shotRows ?? []) {
    const list = shotMap.get(row.product_id) ?? [];
    if (list.length < 4) list.push(screenshotUrl(row.path));
    shotMap.set(row.product_id, list);
  }
  return merged.map((it) => ({ ...it, screens: shotMap.get(it.id) ?? [] }));
}

const HOME_CATEGORIES: RemoteProductType[] = [
  "scenario",
  "rulebook",
  "character_art",
  "map",
  "bgm_audio",
];

export interface StoreHome {
  featured: FeaturedItem[];
  trending: StoreItem[];
  recent: StoreItem[];
  topRated: StoreItem[];
  topCreators: TopCreatorEntry[];
  byCategory: { category: RemoteProductType; items: StoreItem[] }[];
}

/** ホーム一式をまとめて取得(α 規模なので並列に投げるだけ)。 */
export async function fetchStoreHome(): Promise<StoreHome> {
  const [featured, trending, recent, topRated, topCreators, ...cats] =
    await Promise.all([
      fetchFeaturedItems(6),
      fetchTrendingItems(12),
      fetchRecentItems(12),
      fetchTopRatedItems(12),
      fetchTopCreators(3),
      ...HOME_CATEGORIES.map((c) =>
        fetchByRating({
          page: 1,
          pageSize: 8,
          searchIds: null,
          opts: { category: c },
        }).then((r) => r.items),
      ),
    ]);
  return {
    featured,
    trending,
    recent,
    topRated,
    topCreators,
    byCategory: HOME_CATEGORIES.map((category, i) => ({
      category,
      items: cats[i] ?? [],
    })).filter((c) => c.items.length > 0),
  };
}

/* ===== 人気クリエイター TOP N(Web の getTopCreators 移植) ===== */

export interface TopCreatorEntry {
  rank: number;
  creator: { id: string; displayName: string; avatarUrl: string | null };
  totalSales: number;
  /** その creator のベストセラー作品(クリックで詳細を開ける)。 */
  topProduct: StoreItem;
}

/**
 * paid 購入の多い creator を上位 N 件、各 creator のベストセラー作品つきで返す。
 * Web の lib/queries/top-creators.ts と同じ集計手順を anon client で行う。
 * purchases が読めない / 0 件のときは空配列(セクション非表示)。
 */
export async function fetchTopCreators(limit = 3): Promise<TopCreatorEntry[]> {
  const { data: purchases, error } = await supabase
    .from("purchases")
    .select("product_id")
    .eq("status", "paid")
    .limit(5000);
  if (error || !purchases || purchases.length === 0) return [];

  const productIds = Array.from(new Set(purchases.map((p) => p.product_id)));
  const { data: productRows } = await supabase
    .from("products")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .in("id", productIds);
  if (!productRows || productRows.length === 0) return [];

  // product 別の購入数。
  const productCounts = new Map<string, number>();
  for (const p of purchases) {
    productCounts.set(p.product_id, (productCounts.get(p.product_id) ?? 0) + 1);
  }

  // creator 別の合計売上 + ベストセラー作品(最多購入の作品)。
  const creatorSales = new Map<string, number>();
  const creatorTopRow = new Map<string, ListRow>();
  const creatorTopCount = new Map<string, number>();
  for (const row of productRows as ListRow[]) {
    const count = productCounts.get(row.id) ?? 0;
    creatorSales.set(
      row.creator_id,
      (creatorSales.get(row.creator_id) ?? 0) + count,
    );
    const currentTop = creatorTopCount.get(row.creator_id) ?? -1;
    if (count > currentTop) {
      creatorTopCount.set(row.creator_id, count);
      creatorTopRow.set(row.creator_id, row);
    }
  }

  const sortedCreatorIds = Array.from(creatorSales.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
  if (sortedCreatorIds.length === 0) return [];

  // ベストセラー行を StoreItem 化(プロフィール / レビューもまとめて解決)。
  const topRows = sortedCreatorIds
    .map((id) => creatorTopRow.get(id))
    .filter((r): r is ListRow => Boolean(r));
  const items = await toStoreItems(topRows);
  const itemById = new Map(items.map((it) => [it.id, it] as const));

  return sortedCreatorIds.flatMap((creatorId, i) => {
    const topRow = creatorTopRow.get(creatorId);
    const topProduct = topRow ? itemById.get(topRow.id) : undefined;
    if (!topProduct) return [];
    return [
      {
        rank: i + 1,
        creator: {
          id: topProduct.creator.id,
          displayName: topProduct.creator.displayName,
          avatarUrl: topProduct.creator.avatarUrl,
        },
        totalSales: creatorSales.get(creatorId) ?? 0,
        topProduct,
      },
    ];
  });
}

/** カードホバー用: 商品のスクリーンショット URL(最大 5 枚)。 */
export async function fetchScreenshotUrls(productId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("product_screenshots")
    .select("path, order_index")
    .eq("product_id", productId)
    .order("order_index", { ascending: true })
    .limit(5);
  if (error || !data) return [];
  return data.map((r) => screenshotUrl(r.path));
}

/* ===== クリエイター一覧(「クリエイターを探す」) ===== */

export interface StoreCreator {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  workCount: number;
}

/** 公開作品を持つクリエイターを作品数の多い順に返す。 */
export async function fetchStoreCreators(): Promise<StoreCreator[]> {
  const { data, error } = await supabase
    .from("products")
    .select("creator_id")
    .eq("status", "published")
    .limit(5000);
  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    counts.set(r.creator_id, (counts.get(r.creator_id) ?? 0) + 1);
  }
  const ids = Array.from(counts.keys());
  if (ids.length === 0) return [];

  const profiles = await fetchProfiles(ids);
  return ids
    .map((id) => ({
      id,
      displayName: profiles.get(id)?.displayName ?? "",
      avatarUrl: profiles.get(id)?.avatarUrl ?? null,
      bio: profiles.get(id)?.bio ?? "",
      workCount: counts.get(id) ?? 0,
    }))
    .sort((a, b) => b.workCount - a.workCount);
}

/* ===== レビュー投稿(アプリ内・購入済みのみ。RLS で購入を要求) ===== */

export interface MyReview {
  stars: number;
  comment: string;
}

/** 自分のレビュー(あれば)。投稿フォームの初期値に使う。 */
export async function fetchMyReview(
  productId: string,
  userId: string,
): Promise<MyReview | null> {
  const { data, error } = await supabase
    .from("product_reviews")
    .select("stars, rating, comment")
    .eq("product_id", productId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return { stars: starsOf(data), comment: data.comment ?? "" };
}

/**
 * レビューを投稿 / 上書き(購入済みのみ)。star(1..5)を保存し、後方互換の
 * rating(>=4 を高評価)も導出して書く。購入していない場合は RLS で弾かれ、
 * その旨を throw する。
 */
export async function submitReview(
  productId: string,
  userId: string,
  stars: number,
  comment: string,
): Promise<void> {
  const s = Math.max(1, Math.min(5, Math.round(stars)));
  const { error } = await supabase.from("product_reviews").upsert(
    {
      product_id: productId,
      user_id: userId,
      stars: s,
      rating: s >= 4 ? "positive" : "negative",
      comment: comment.slice(0, 2000),
    },
    { onConflict: "product_id,user_id" },
  );
  if (error) {
    throw new Error(
      "レビューを保存できませんでした。購入済みの作品のみレビューできます。",
    );
  }
}

/** 自分のレビューを削除。 */
export async function deleteMyReview(
  productId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("product_reviews")
    .delete()
    .eq("product_id", productId)
    .eq("user_id", userId);
  if (error) throw new Error("レビューの削除に失敗しました。");
}

/** 自分の paid 購入の product_id 集合(購入済みバッジ用)。 */
export async function fetchMyPurchasedIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("purchases")
    .select("product_id")
    .eq("user_id", userId)
    .eq("status", "paid");
  return new Set((data ?? []).map((r) => r.product_id));
}

/** 価格表示(0 円は「無料」)。 */
export function formatPriceJpy(jpy: number): string {
  return jpy === 0 ? "無料" : `¥${jpy.toLocaleString("ja-JP")}`;
}

/**
 * 割引後の実効価格(円・整数)。discountPercent は 0..100。
 *   salePriceJpy(1000, 30) -> 700 / salePriceJpy(500, 100) -> 0(無料配布)
 * web 側 lib/format/price.ts の salePriceJpy と同じ計算(決済と表示で一致させる)。
 */
export function salePriceJpy(priceJpy: number, discountPercent: number): number {
  const d = Math.min(100, Math.max(0, Math.round(discountPercent || 0)));
  if (d <= 0) return priceJpy;
  return Math.max(0, Math.round((priceJpy * (100 - d)) / 100));
}

/** 割引が効いているか(率が 1 以上 かつ 定価が有料)。 */
export function hasDiscount(priceJpy: number, discountPercent: number): boolean {
  return priceJpy > 0 && discountPercent > 0;
}

/** セール期間内か(両方 null は常に有効)。web lib/format/price.ts と同じ判定。 */
export function isDiscountActive(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (startsAt) {
    const s = Date.parse(startsAt);
    if (!Number.isNaN(s) && now < s) return false;
  }
  if (endsAt) {
    const e = Date.parse(endsAt);
    if (!Number.isNaN(e) && now > e) return false;
  }
  return true;
}

/**
 * セール終了までの残り時間ラベル。終了日時なし/終了済みは null。
 *   3日以上 → 「あと3日」 / 24h未満 → 「あと5時間」 / 1h未満 → 「まもなく終了」
 * 購入直前の「今買う理由」(緊急性)を作る。Steam のセール表記と同じ発想。
 */
export function saleEndsInLabel(
  endsAt: string | null | undefined,
  now: number = Date.now(),
): string | null {
  if (!endsAt) return null;
  const e = Date.parse(endsAt);
  if (Number.isNaN(e)) return null;
  const ms = e - now;
  if (ms <= 0) return null;
  const hours = ms / 3_600_000;
  if (hours < 1) return "まもなく終了";
  if (hours < 24) return `あと${Math.floor(hours)}時間`;
  return `あと${Math.ceil(hours / 24)}日`;
}

/**
 * 「今」効いている実効割引率。率 0 以下 or 期間外なら 0(=定価)。
 * 表示は salePriceJpy(price, effectiveDiscountPercent(...)) で実効価格を出す。
 */
export function effectiveDiscountPercent(
  discountPercent: number,
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now: number = Date.now(),
): number {
  const d = Math.min(100, Math.max(0, Math.round(discountPercent || 0)));
  if (d <= 0) return 0;
  return isDiscountActive(startsAt, endsAt, now) ? d : 0;
}

/**
 * Web 版の商品ページ URL(決済はブラウザで行う)。
 *
 * `?from=desktop` を付けることで、web 側 buy-button が checkout API に
 * `returnTo: "desktop"` を伝え、決済成功/キャンセル時に
 * paradice://purchase/* deep link でアプリへ自動で戻れる。
 */
export function webProductUrl(slug: string): string {
  const base = import.meta.env.VITE_WEB_BASE_URL ?? "http://localhost:3000";
  return `${base}/store/${slug}?from=desktop`;
}
