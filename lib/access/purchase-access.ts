import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Purchase access checks.
 *
 * Two functions:
 *   - canPurchase(userId, productId)         used by POST /api/checkout
 *   - isAlreadyPurchased(userId, productId)  used by /store/[slug] to swap CTA
 *
 * Defense in depth:
 *   - canPurchase never trusts client-supplied price/title — those come from
 *     the products table itself.
 *   - "creator's own product" and "product not found / not published" collapse
 *     into the same `not_found` response so existence isn't leaked via 404s
 *     on draft / suspended products.
 */

export type ProductForCheckout = {
  id: string;
  slug: string;
  title: string;
  priceJpy: number;
  productType: string;
  creatorId: string;
};

export type PurchaseDecision =
  | { ok: true; product: ProductForCheckout }
  | {
      ok: false;
      reason: "not_found" | "free" | "already_purchased";
      status: 400 | 404 | 409;
      message: string;
    };

export async function canPurchase(
  userId: string,
  productId: string,
): Promise<PurchaseDecision> {
  if (!isUuid(productId)) {
    return {
      ok: false,
      reason: "not_found",
      status: 404,
      message: "作品が見つかりません",
    };
  }

  const supabase = createClient();

  // Fetch the product. RLS for an authenticated user permits read when the
  // product is 'published' OR the user is the creator. Both cases are
  // possible here; we filter explicitly below.
  const { data: product, error } = await supabase
    .from("products")
    .select("id, slug, title, price_jpy, product_type, creator_id, status")
    .eq("id", productId)
    .maybeSingle();

  if (error || !product) {
    return {
      ok: false,
      reason: "not_found",
      status: 404,
      message: "作品が見つかりません",
    };
  }

  // Hide draft / suspended / own products behind the same 404.
  if (product.status !== "published" || product.creator_id === userId) {
    return {
      ok: false,
      reason: "not_found",
      status: 404,
      message: "作品が見つかりません",
    };
  }

  if (product.price_jpy <= 0) {
    return {
      ok: false,
      reason: "free",
      status: 400,
      message: "無料作品の入手は準備中です",
    };
  }

  // Already-purchased check. Surface this explicitly — UX over secrecy here
  // because the user already owns the product and benefits from being told.
  const purchased = await isAlreadyPurchased(userId, productId);
  if (purchased) {
    return {
      ok: false,
      reason: "already_purchased",
      status: 409,
      message: "すでに購入済みの作品です。ライブラリからご利用ください",
    };
  }

  return {
    ok: true,
    product: {
      id: product.id,
      slug: product.slug,
      title: product.title,
      priceJpy: product.price_jpy,
      productType: product.product_type,
      creatorId: product.creator_id,
    },
  };
}

export async function isAlreadyPurchased(
  userId: string,
  productId: string,
): Promise<boolean> {
  if (!isUuid(productId)) return false;
  const supabase = createClient();
  const { data } = await supabase
    .from("purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .eq("status", "paid")
    .limit(1)
    .maybeSingle();
  return !!data;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
