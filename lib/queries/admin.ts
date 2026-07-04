import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductType } from "./types";
import type { ProductStatus } from "@/lib/format/status";
import type { ReportCategory, ReportStatus } from "@/lib/validators/report";
import { isAiVerdict, type AiVerdict } from "@/lib/moderation/verdict";

/**
 * Admin-scoped read queries.
 *
 * RLS already grants admins SELECT on every table when is_admin() is true,
 * so we use the regular auth client — no service_role needed.
 *
 * email is intentionally NOT selected anywhere in this module.
 */

export const ADMIN_PAGE_SIZE_USERS = 30;
export const ADMIN_PAGE_SIZE_PRODUCTS = 30;
export const ADMIN_PAGE_SIZE_ORDERS = 30;
export const ADMIN_PAGE_SIZE_REPORTS = 30;

// =====================================================================
// Users
// =====================================================================

export type AdminUserRow = {
  id: string;
  displayName: string;
  isCreator: boolean;
  isAdmin: boolean;
  goldBalance: number;
  createdAt: string;
};

export type AdminListResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function listUsersForAdmin(opts?: {
  search?: string;
  page?: number;
}): Promise<AdminListResult<AdminUserRow>> {
  const supabase = createClient();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = ADMIN_PAGE_SIZE_USERS;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("profiles")
    .select(
      "id, display_name, is_creator, is_admin, gold_balance, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  const search = opts?.search?.trim();
  if (search) {
    // Escape % and _ for ILIKE safety.
    const safe = search.replace(/[\\%_]/g, (s) => `\\${s}`);
    query = query.ilike("display_name", `%${safe}%`);
  }

  const { data, count, error } = await query;
  if (error) {
    console.error("[listUsersForAdmin] failed", error);
    return emptyResult(page, pageSize);
  }

  const items: AdminUserRow[] = (data ?? []).map((r) => ({
    id: r.id,
    displayName: r.display_name ?? "",
    isCreator: !!r.is_creator,
    isAdmin: !!r.is_admin,
    goldBalance: r.gold_balance ?? 0,
    createdAt: r.created_at,
  }));

  return buildResult(items, count ?? 0, page, pageSize);
}

// =====================================================================
// Products
// =====================================================================

export type AdminProductRow = {
  id: string;
  title: string;
  creatorId: string;
  creatorName: string;
  status: ProductStatus;
  productType: ProductType;
  priceJpy: number;
  updatedAt: string;
  reviewNote: string | null;
  aiVerdict: AiVerdict | null;
  aiReason: string | null;
  openReportCount: number;
};

export async function listProductsForAdmin(opts?: {
  search?: string;
  status?: ProductStatus | "all";
  page?: number;
}): Promise<AdminListResult<AdminProductRow>> {
  const supabase = createClient();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = ADMIN_PAGE_SIZE_PRODUCTS;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("products")
    .select(
      "id, title, creator_id, status, product_type, price_jpy, updated_at, review_note, ai_verdict, ai_reason",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (opts?.status && opts.status !== "all") {
    query = query.eq("status", opts.status);
  }

  const search = opts?.search?.trim();
  if (search) {
    const safe = search.replace(/[\\%_]/g, (s) => `\\${s}`);
    query = query.ilike("title", `%${safe}%`);
  }

  const { data, count, error } = await query;
  if (error) {
    console.error("[listProductsForAdmin] failed", error);
    return emptyResult(page, pageSize);
  }

  // Resolve creator display names + open report counts in batches.
  const creatorIds = Array.from(new Set((data ?? []).map((r) => r.creator_id)));
  const productIds = (data ?? []).map((r) => r.id);
  const [nameMap, reportCountMap] = await Promise.all([
    fetchCreatorNames(creatorIds),
    fetchOpenReportCounts(productIds),
  ]);

  const items: AdminProductRow[] = (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    creatorId: r.creator_id,
    creatorName: nameMap.get(r.creator_id) ?? "",
    status: r.status as ProductStatus,
    productType: r.product_type as ProductType,
    priceJpy: r.price_jpy,
    updatedAt: r.updated_at,
    reviewNote: (r as { review_note?: string | null }).review_note ?? null,
    aiVerdict: ((): AiVerdict | null => {
      const v = (r as { ai_verdict?: unknown }).ai_verdict;
      return isAiVerdict(v) ? v : null;
    })(),
    aiReason: (r as { ai_reason?: string | null }).ai_reason ?? null,
    openReportCount: reportCountMap.get(r.id) ?? 0,
  }));

  return buildResult(items, count ?? 0, page, pageSize);
}

/** 指定した作品群の open な通報件数を一括取得する。 */
async function fetchOpenReportCounts(
  productIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (productIds.length === 0) return result;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_reports")
    .select("product_id")
    .in("product_id", productIds)
    .eq("status", "open");
  if (error) {
    console.error("[fetchOpenReportCounts] failed", error);
    return result;
  }
  for (const row of data ?? []) {
    result.set(row.product_id, (result.get(row.product_id) ?? 0) + 1);
  }
  return result;
}

/**
 * 審査待ち(pending)件数。admin の作品ページに「審査キュー」の件数バッジを
 * 出すために使う。RLS は admin に全件 SELECT を許すので通常クライアントで可。
 */
export async function countPendingProducts(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) {
    console.error("[countPendingProducts] failed", error);
    return 0;
  }
  return count ?? 0;
}

// =====================================================================
// Orders (purchases)
// =====================================================================

export type AdminOrderRow = {
  id: string;
  paidAt: string | null;
  createdAt: string;
  productId: string;
  productTitle: string;
  buyerLabel: string;
  amountJpy: number;
  currency: string;
  status: "paid" | "refunded" | "pending";
  stripeSessionId: string;
};

export async function listOrdersForAdmin(opts?: {
  page?: number;
}): Promise<AdminListResult<AdminOrderRow>> {
  const supabase = createClient();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = ADMIN_PAGE_SIZE_ORDERS;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await supabase
    .from("purchases")
    .select(
      "id, user_id, product_id, amount_jpy, currency, status, stripe_session_id, paid_at, created_at",
      { count: "exact" },
    )
    .order("paid_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[listOrdersForAdmin] failed", error);
    return emptyResult(page, pageSize);
  }

  const productIds = Array.from(new Set((data ?? []).map((r) => r.product_id)));
  const userIds = Array.from(
    new Set((data ?? []).map((r) => r.user_id).filter((x): x is string => !!x)),
  );

  const [productMap, userMap] = await Promise.all([
    fetchProductTitles(productIds),
    fetchCreatorNames(userIds),
  ]);

  const items: AdminOrderRow[] = (data ?? []).map((r) => ({
    id: r.id,
    paidAt: r.paid_at,
    createdAt: r.created_at,
    productId: r.product_id,
    productTitle: productMap.get(r.product_id) ?? "(取得不可)",
    buyerLabel: buildBuyerLabel(r.user_id, userMap),
    amountJpy: r.amount_jpy,
    currency: r.currency,
    status: r.status as "paid" | "refunded" | "pending",
    stripeSessionId: r.stripe_session_id,
  }));

  return buildResult(items, count ?? 0, page, pageSize);
}

// =====================================================================
// Reports (product_reports)
// =====================================================================

export type AdminReportRow = {
  id: string;
  productId: string;
  productTitle: string;
  reporterLabel: string;
  category: ReportCategory;
  reason: string;
  status: ReportStatus;
  createdAt: string;
};

export async function listReportsForAdmin(opts?: {
  status?: ReportStatus | "all";
  page?: number;
}): Promise<AdminListResult<AdminReportRow>> {
  const supabase = createClient();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = ADMIN_PAGE_SIZE_REPORTS;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("product_reports")
    .select(
      "id, product_id, reporter_id, category, reason, status, created_at",
      { count: "exact" },
    )
    // open を先に、その後新しい順。
    .order("created_at", { ascending: false })
    .range(from, to);

  if (opts?.status && opts.status !== "all") {
    query = query.eq("status", opts.status);
  }

  const { data, count, error } = await query;
  if (error) {
    console.error("[listReportsForAdmin] failed", error);
    return emptyResult(page, pageSize);
  }

  const productIds = Array.from(new Set((data ?? []).map((r) => r.product_id)));
  const reporterIds = Array.from(new Set((data ?? []).map((r) => r.reporter_id)));
  const [titleMap, nameMap] = await Promise.all([
    fetchProductTitles(productIds),
    fetchCreatorNames(reporterIds),
  ]);

  const items: AdminReportRow[] = (data ?? []).map((r) => ({
    id: r.id,
    productId: r.product_id,
    productTitle: titleMap.get(r.product_id) ?? "(取得不可)",
    reporterLabel:
      nameMap.get(r.reporter_id) || `${r.reporter_id.slice(0, 8)}…`,
    category: r.category as ReportCategory,
    reason: r.reason,
    status: r.status as ReportStatus,
    createdAt: r.created_at,
  }));

  return buildResult(items, count ?? 0, page, pageSize);
}

/** 未対応(open)の通報件数。admin index / nav のバッジ用。 */
export async function countOpenReports(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("product_reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  if (error) {
    console.error("[countOpenReports] failed", error);
    return 0;
  }
  return count ?? 0;
}

// =====================================================================
// Helpers
// =====================================================================

async function fetchCreatorNames(ids: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (ids.length === 0) return result;
  const supabase = createClient();
  const { data } = await supabase
    .from("public_profiles")
    .select("id, display_name")
    .in("id", ids);
  for (const row of data ?? []) {
    result.set(row.id, row.display_name ?? "");
  }
  return result;
}

async function fetchProductTitles(ids: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (ids.length === 0) return result;
  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select("id, title")
    .in("id", ids);
  for (const row of data ?? []) {
    result.set(row.id, row.title);
  }
  return result;
}

function buildBuyerLabel(
  userId: string | null,
  nameMap: Map<string, string>,
): string {
  if (!userId) return "(退会済ユーザー)";
  const name = nameMap.get(userId);
  if (name && name.length > 0) return name;
  return `${userId.slice(0, 8)}…`;
}

function emptyResult<T>(page: number, pageSize: number): AdminListResult<T> {
  return { items: [], total: 0, page, pageSize, totalPages: 0 };
}

function buildResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): AdminListResult<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
