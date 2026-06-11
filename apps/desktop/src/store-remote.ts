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

export type StoreSort = "published" | "rating";

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
  label: ReviewLabel;
}

export interface StoreItem {
  id: string;
  slug: string;
  title: string;
  productType: RemoteProductType;
  priceJpy: number;
  coverUrl: string | null;
  systemLabel: string | null;
  publishedAt: string;
  creator: { id: string; displayName: string; avatarUrl: string | null };
  review: StoreReviewSummary | null;
}

export interface StoreReview {
  id: string;
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

function computeReviewLabel(positive: number, total: number): ReviewLabel {
  if (total === 0) return "評価なし";
  if (total < 5) return "評価不足";
  const ratio = positive / total;
  if (ratio >= 0.95) return "圧倒的に好評";
  if (ratio >= 0.8) return "非常に好評";
  if (ratio >= 0.7) return "ほぼ好評";
  if (ratio >= 0.4) return "賛否両論";
  if (ratio >= 0.2) return "やや不評";
  if (ratio >= 0.05) return "不評";
  return "圧倒的に不評";
}

async function fetchReviewSummaries(
  productIds: string[],
): Promise<Map<string, StoreReviewSummary>> {
  const result = new Map<string, StoreReviewSummary>();
  if (productIds.length === 0) return result;
  const { data, error } = await supabase
    .from("product_reviews")
    .select("product_id, rating")
    .in("product_id", productIds);
  if (error) return result;

  const counts = new Map<string, { positive: number; total: number }>();
  for (const row of data ?? []) {
    const c = counts.get(row.product_id) ?? { positive: 0, total: 0 };
    c.total++;
    if (row.rating === "positive") c.positive++;
    counts.set(row.product_id, c);
  }
  for (const [id, c] of counts.entries()) {
    result.set(id, {
      total: c.total,
      positive: c.positive,
      label: computeReviewLabel(c.positive, c.total),
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
  "id, slug, title, product_type, price_jpy, cover_path, system_label, published_at, creator_id";

type ListRow = {
  id: string;
  slug: string;
  title: string;
  product_type: string;
  price_jpy: number;
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

/** ストア一覧(カテゴリ / 検索 / 並び順 / ページ)。 */
export async function fetchStore(opts: {
  category?: RemoteProductType | null;
  q?: string | null;
  sort?: StoreSort;
  page?: number;
}): Promise<StoreListResult> {
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
    return fetchByRating({ page, pageSize, category: opts.category ?? null, searchIds });
  }

  const from = (page - 1) * pageSize;
  let query = supabase
    .from("products")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (opts.category) query = query.eq("product_type", opts.category);
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

/** 好評順ソート(Web の listByRating と同じ手順を JS 集計で)。 */
async function fetchByRating(args: {
  page: number;
  pageSize: number;
  category: RemoteProductType | null;
  searchIds: string[] | null;
}): Promise<StoreListResult> {
  const { page, pageSize, category, searchIds } = args;

  let idQuery = supabase
    .from("products")
    .select("id, published_at")
    .eq("status", "published")
    .limit(5000);
  if (category) idQuery = idQuery.eq("product_type", category);
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
    const ratioA = ra && ra.total > 0 ? ra.positive / ra.total : -1;
    const ratioB = rb && rb.total > 0 ? rb.positive / rb.total : -1;
    if (ratioA !== ratioB) return ratioB - ratioA;
    const countA = ra?.positive ?? 0;
    const countB = rb?.positive ?? 0;
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
    .select("id, user_id, rating, comment, created_at")
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

/** Web 版の商品ページ URL(決済はブラウザで行う)。 */
export function webProductUrl(slug: string): string {
  const base = import.meta.env.VITE_WEB_BASE_URL ?? "http://localhost:3000";
  return `${base}/store/${slug}`;
}
