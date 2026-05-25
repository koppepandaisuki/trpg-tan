import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  ProductDetail,
  ProductListItem,
  ProductType,
  FileFormat,
} from "./types";

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
export async function listPublishedProducts(opts?: {
  category?: ProductType | null;
  page?: number;
}): Promise<ListResult> {
  const supabase = createClient();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = STORE_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

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

  const { data: rows, count, error } = await query;
  if (error) {
    console.error("[listPublishedProducts] failed", error);
    return { items: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const creatorIds = Array.from(new Set((rows ?? []).map((r) => r.creator_id)));
  const creators = await fetchPublicProfiles(creatorIds);

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
    },
  }));

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

type PublicProfileRow = {
  displayName: string;
  avatarPath: string | null;
  bio: string;
};

async function fetchPublicProfiles(
  ids: string[],
): Promise<Map<string, PublicProfileRow>> {
  const result = new Map<string, PublicProfileRow>();
  if (ids.length === 0) return result;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, display_name, avatar_path, bio")
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
