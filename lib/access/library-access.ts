import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Library access check.
 *
 * The ONLY function that answers "may this user download this product?".
 * Used by the signed-URL route handler. Returns a tagged union so the
 * caller can log the reason internally while presenting a generic response
 * to the client.
 *
 * Note: this uses the anon/auth client (not service_role). RLS on
 * purchases (purchases_select_own) and on products (status='published' or
 * own/admin) already does the heavy lifting. We re-assert the filter in
 * code so the intent is readable.
 *
 * `client` is optional: the cookie path passes nothing (we build the SSR
 * client), the desktop Bearer path passes a token-authed client so RLS still
 * resolves `auth.uid()` to the same user.
 */

export type DownloadDecision =
  | { ok: true; filePath: string }
  | {
      ok: false;
      reason:
        | "not_purchased"
        | "refunded"
        | "no_file"
        | "suspended"
        | "not_found";
    };

export async function canDownload(
  userId: string,
  productId: string,
  client?: SupabaseClient,
): Promise<DownloadDecision> {
  if (!isUuid(productId)) {
    return { ok: false, reason: "not_found" };
  }

  const supabase = client ?? createClient();

  // 1. Purchase existence and status.
  //    We pull both 'paid' and 'refunded' rows here (not just 'paid') so
  //    we can distinguish "never bought it" from "bought then refunded".
  //    Both paths return ok=false at the route handler with the same
  //    generic 403, but the reason is preserved in the server log for
  //    diagnostics. Order by paid_at desc so the most recent transaction
  //    wins if a buyer has multiple rows (e.g. previously refunded then
  //    re-purchased — rare but defensive).
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, status")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .in("status", ["paid", "refunded"])
    .order("paid_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!purchase) {
    return { ok: false, reason: "not_purchased" };
  }
  if (purchase.status === "refunded") {
    return { ok: false, reason: "refunded" };
  }

  // 2. Product details. We allow this read even if it is suspended-but-owned
  //    elsewhere only because the user has a purchase row.
  const { data: product } = await supabase
    .from("products")
    .select("status, file_path")
    .eq("id", productId)
    .maybeSingle();

  if (!product) {
    // Product is suspended and belongs to another creator — RLS hides it.
    return { ok: false, reason: "suspended" };
  }

  if (product.status === "suspended") {
    return { ok: false, reason: "suspended" };
  }
  if (product.status !== "published") {
    // draft — should never happen for a purchased item, but be defensive.
    return { ok: false, reason: "suspended" };
  }
  if (!product.file_path) {
    return { ok: false, reason: "no_file" };
  }

  return { ok: true, filePath: product.file_path };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
