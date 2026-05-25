import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductType } from "./types";
import type { ProductStatus } from "@/lib/format/status";

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

// =====================================================================
// Users
// =====================================================================

export type AdminUserRow = {
  id: string;
  displayName: string;
  isCreator: boolean;
  isAdmin: boolean;
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
    .select("id, display_name, is_creator, is_admin, created_at", {
      count: "exact",
    })
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
      "id, title, creator_id, status, product_type, price_jpy, updated_at",
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

  // Resolve creator display names in one batch via public_profiles.
  const creatorIds = Array.from(new Set((data ?? []).map((r) => r.creator_id)));
  const nameMap = await fetchCreatorNames(creatorIds);

  const items: AdminProductRow[] = (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    creatorId: r.creator_id,
    creatorName: nameMap.get(r.creator_id) ?? "",
    status: r.status as ProductStatus,
    productType: r.product_type as ProductType,
    priceJpy: r.price_jpy,
    updatedAt: r.updated_at,
  }));

  return buildResult(items, count ?? 0, page, pageSize);
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
