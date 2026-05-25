import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductType, FileFormat } from "./types";
import type { ProductStatus } from "@/lib/format/status";

/**
 * Library queries — strictly read-only, server-only.
 *
 * Two safety properties to keep:
 *   1. file_path is fetched internally but NEVER exposed to callers.
 *      We collapse it to a boolean (hasFile) so the DOM cannot leak the
 *      Storage key by accident.
 *   2. Filtered by purchases.status='paid' and by user_id; admins use a
 *      different code path (Phase 8), not this one.
 *
 * The product's own status (published/suspended/draft) is included so the
 * UI can disable the download button without hiding the row.
 */

export type LibraryAvailability = "available" | "no_file" | "suspended" | "blocked";

export type LibraryItem = {
  purchaseId: string;
  productId: string;
  slug: string;
  title: string;
  productType: ProductType;
  fileFormat: FileFormat;
  productStatus: ProductStatus;
  coverPath: string | null;
  amountJpy: number;
  currency: string;
  paidAt: string;
  hasFile: boolean;
  availability: LibraryAvailability;
  creator: { id: string; displayName: string };
};

const PURCHASE_COLUMNS =
  "id, product_id, amount_jpy, currency, paid_at, status";

const PRODUCT_COLUMNS =
  // file_path is fetched so we can compute hasFile, then dropped before return.
  "id, slug, title, product_type, file_format, status, cover_path, file_path, creator_id";

export async function listMyLibrary(userId: string): Promise<LibraryItem[]> {
  const supabase = createClient();

  // 1. Paid purchases for this user.
  const { data: purchases, error: purErr } = await supabase
    .from("purchases")
    .select(PURCHASE_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false });

  if (purErr) {
    console.error("[listMyLibrary] purchases fetch failed", purErr);
    return [];
  }
  if (!purchases || purchases.length === 0) return [];

  // 2. Products referenced by those purchases. RLS-wise: creator_id is on
  //    the product, but `purchases_select_own` lets the user see their
  //    purchases, and `products_select_published / _own / _admin` would
  //    block suspended rows for a regular user. To avoid the row vanishing
  //    when a creator suspends a sold product, query via service_role would
  //    be tempting — but we want to keep this on the anon/auth client.
  //
  //    Workaround: products RLS allows SELECT for `creator_id = auth.uid()`
  //    OR `status='published'`. Suspended products owned by SOMEONE ELSE
  //    will not be readable. We accept that as a limitation: such rows are
  //    rendered as a placeholder "配布停止中" using purchase fields alone.
  //
  //    For now, surface what we can read. Suspended-by-other rows simply
  //    render the title from a fallback. This is acceptable for MVP and is
  //    revisited in Phase 8 when admin views land.
  const productIds = Array.from(new Set(purchases.map((p) => p.product_id)));
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .in("id", productIds);

  if (prodErr) {
    console.error("[listMyLibrary] products fetch failed", prodErr);
    return [];
  }

  const productMap = new Map((products ?? []).map((p) => [p.id, p]));

  // 3. Public creator profiles in one batch.
  const creatorIds = Array.from(
    new Set((products ?? []).map((p) => p.creator_id).filter(Boolean)),
  );
  const creatorMap = new Map<string, { id: string; displayName: string }>();
  if (creatorIds.length > 0) {
    const { data: creators } = await supabase
      .from("public_profiles")
      .select("id, display_name")
      .in("id", creatorIds);
    for (const c of creators ?? []) {
      creatorMap.set(c.id, { id: c.id, displayName: c.display_name ?? "" });
    }
  }

  // 4. Build the public-facing items. file_path is consumed here and dropped.
  return purchases
    .map<LibraryItem | null>((purchase) => {
      const product = productMap.get(purchase.product_id);
      if (!product) {
        // RLS blocked (e.g. suspended product owned by someone else).
        // Render a minimal placeholder row so the user still sees the purchase.
        return {
          purchaseId: purchase.id,
          productId: purchase.product_id,
          slug: "",
          title: "(配布停止中の作品)",
          productType: "scenario",
          fileFormat: "pdf",
          productStatus: "suspended",
          coverPath: null,
          amountJpy: purchase.amount_jpy,
          currency: purchase.currency,
          paidAt: purchase.paid_at,
          hasFile: false,
          availability: "suspended",
          creator: { id: "", displayName: "" },
        };
      }

      const productStatus = product.status as ProductStatus;
      const hasFile = !!product.file_path;
      const availability: LibraryAvailability =
        productStatus === "suspended"
          ? "suspended"
          : productStatus !== "published"
            ? "blocked"
            : !hasFile
              ? "no_file"
              : "available";

      return {
        purchaseId: purchase.id,
        productId: product.id,
        slug: product.slug,
        title: product.title,
        productType: product.product_type as ProductType,
        fileFormat: product.file_format as FileFormat,
        productStatus,
        coverPath: product.cover_path,
        amountJpy: purchase.amount_jpy,
        currency: purchase.currency,
        paidAt: purchase.paid_at,
        hasFile,
        availability,
        creator:
          creatorMap.get(product.creator_id) ?? {
            id: product.creator_id,
            displayName: "",
          },
      };
    })
    .filter((x): x is LibraryItem => x !== null);
}
