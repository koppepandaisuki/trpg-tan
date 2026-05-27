import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Purchase access checks.
 *
 * Two functions:
 *   - canPurchase(userId, productId)        used by POST /api/checkout
 *   - isAlreadyPurchased(userId, productId)  used by /store/[slug] to swap CTA
 *
 * Defense in depth:
 *   - canPurchase never trusts client-supplied price/title — those come from
 *     the products table itself.
 *   - "creator's own product" and "product not found / not published" collapse
 *     into the same `not_found` response so existence isn't leaked via 404s
 *     on draft / suspended products.
 *   - (D-020 PR3) canPurchase also fetches creator's stripe_account_id so
 *     the checkout route can wire transfer_data.destination without an extra
 *     round-trip.
 */

export type ProductForCheckout = {
  id: string;
  slug: string;
  title: string;
  priceJpy: number;
  productType: string;
  creatorId: string;
  /** Stripe Connect account ID of the creator (null when not onboarded). */
  creatorStripeAccountId: string | null;
};

export type PurchaseDecision =
  | { ok: true; product: ProductForCheckout }
  | {
      ok: false;
      reason: "not_found" | "free" | "already_purchased" | "creator_not_onboarded";
      status: number;
      message: string;
    };

/**
 * canPurchase — gate for POST /api/checkout.
 *
 * Returns ok:true + product details (incl. creator stripe account) when the
 * purchase is allowed; ok:false with a reason otherwise.
 */
export async function canPurchase(
  userId: string,
  productId: string,
): Promise<PurchaseDecision> {
  const supabase = createClient();

  // Fetch product + creator stripe info in one query via join.
  const { data: product, error } = await supabase
    .from("products")
    .select(
      `id, slug, title, price_jpy, product_type, creator_id, status,
       profiles!creator_id ( stripe_account_id, stripe_charges_enabled )`,
    )
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      reason: "not_found",
      status: 500,
      message: "データベースエラーが発生しました",
    };
  }

  // Hide draft / suspended / own products behind the same 404.
  if (
    !product ||
    product.status !== "published" ||
    product.creator_id === userId
  ) {
    return {
      ok: false,
      reason: "not_found",
      status: 404,
      message: "作品が見つかりません",
    };
  }

  // Free products are not purchasable via Stripe.
  if (product.price_jpy === 0) {
    return {
      ok: false,
      reason: "free",
      status: 400,
      message: "この作品は無料です",
    };
  }

  // (D-020 PR3) Creator must have completed Stripe Connect onboarding.
  const creatorProfile = Array.isArray(product.profiles)
    ? product.profiles[0]
    : product.profiles;
  if (!creatorProfile?.stripe_charges_enabled) {
    return {
      ok: false,
      reason: "creator_not_onboarded",
      status: 503,
      message: "クリエイターの決済設定が完了していません",
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
      creatorStripeAccountId: creatorProfile.stripe_account_id ?? null,
    },
  };
}

/**
 * isAlreadyPurchased — used by /store/[slug] to render the correct CTA.
 */
export async function isAlreadyPurchased(
  userId: string,
  productId: string,
): Promise<boolean> {
  const supabase = createClient();

  const { data } = await supabase
    .from("purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();

  return data !== null;
}
