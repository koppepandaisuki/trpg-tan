import "server-only";
import { createClient } from "@/lib/supabase/server";
import { salePriceJpy } from "@/lib/format/price";

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
 *   - (D-020 PR3) canPurchase additionally fetches the creator's Stripe
 *     Connect status via a join so the checkout route can wire
 *     transfer_data.destination + application_fee_amount without an extra
 *     round-trip, and so we can refuse purchases when the creator's
 *     onboarding is incomplete (`creator_not_onboarded`).
 */

export type ProductForCheckout = {
  id: string;
  slug: string;
  title: string;
  /** 定価(円)。表示・記録用。実際の請求は salePriceJpy(priceJpy, discountPercent)。*/
  priceJpy: number;
  /** 割引率(0..100)。100 = 無料配布。*/
  discountPercent: number;
  productType: string;
  creatorId: string;
  /** Stripe Connect account ID of the creator. priceJpy>0 のときは必須
   *  (creator_not_onboarded ガードを通っているので非 null)。priceJpy=0
   *  (無料)のときは Stripe を通さないので null になりうる。 */
  creatorStripeAccountId: string | null;
};

export type PurchaseDecision =
  | { ok: true; product: ProductForCheckout }
  | {
      ok: false;
      reason: "not_found" | "already_purchased" | "creator_not_onboarded";
      status: 400 | 404 | 409 | 503;
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

  // Fetch the product joined with the creator's Connect status.
  // RLS for an authenticated user permits read when the product is
  // 'published' OR the user is the creator. Both cases reach here; we
  // filter explicitly below. The profiles join uses `creator_id` FK and
  // is permitted by `public_profiles` access (Connect columns belong to
  // the profiles row owned by the creator; RLS allows reading own + via
  // joined product read paths).
  const { data: product, error } = await supabase
    .from("products")
    .select(
      `id, slug, title, price_jpy, discount_percent, product_type, creator_id, status,
       profiles!products_creator_id_fkey ( stripe_account_id, stripe_charges_enabled )`,
    )
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

  // 実効価格(割引後)が 0 のものは Stripe を通さない。定価が 0 の無料作品に加え、
  // 「割引率 100%」での無料配布もここに含まれる(Stripe の最低決済額未満で必ず
  // 失敗する + クリエイターの Connect 未設定でも配布したい)。
  // checkout 側で direct insert に分岐するため、ここでは ok を返す。
  const discountPercent = product.discount_percent ?? 0;
  const effectivePrice = salePriceJpy(product.price_jpy, discountPercent);
  if (effectivePrice <= 0) {
    return {
      ok: true,
      product: {
        id: product.id,
        slug: product.slug,
        title: product.title,
        priceJpy: product.price_jpy,
        discountPercent,
        productType: product.product_type,
        creatorId: product.creator_id,
        creatorStripeAccountId: null,
      },
    };
  }

  // (D-020 PR3) Creator must have completed Stripe Connect onboarding.
  // We treat missing profile row or null fields as "not onboarded" — the
  // checkout cannot succeed at Stripe without a valid destination
  // account, and revealing more detail would leak Connect state.
  const creatorProfile = Array.isArray(product.profiles)
    ? product.profiles[0]
    : product.profiles;
  const stripeAccountId = creatorProfile?.stripe_account_id ?? null;
  const chargesEnabled = creatorProfile?.stripe_charges_enabled ?? false;
  if (!stripeAccountId || !chargesEnabled) {
    return {
      ok: false,
      reason: "creator_not_onboarded",
      status: 503,
      message:
        "このクリエイターの決済設定が完了していません。しばらく時間をおいて再度お試しください",
    };
  }

  return {
    ok: true,
    product: {
      id: product.id,
      slug: product.slug,
      title: product.title,
      priceJpy: product.price_jpy,
      discountPercent,
      productType: product.product_type,
      creatorId: product.creator_id,
      creatorStripeAccountId: stripeAccountId,
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
