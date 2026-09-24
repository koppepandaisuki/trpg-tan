import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin-scoped read queries.
 *
 * RLS already grants admins SELECT on every table when is_admin() is true,
 * so we use the regular auth client — no service_role needed.
 *
 * email is intentionally NOT selected anywhere in this module.
 *
 * 2026-09 のストア廃止で、作品(審査)・取引・通報の一覧は撤去した。
 */

export const ADMIN_PAGE_SIZE_USERS = 30;

// =====================================================================
// Users
// =====================================================================

export type AdminUserRow = {
  id: string;
  displayName: string;
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
      "id, display_name, is_admin, gold_balance, created_at",
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
    isAdmin: !!r.is_admin,
    goldBalance: r.gold_balance ?? 0,
    createdAt: r.created_at,
  }));

  return buildResult(items, count ?? 0, page, pageSize);
}

// =====================================================================
// Helpers
// =====================================================================


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
