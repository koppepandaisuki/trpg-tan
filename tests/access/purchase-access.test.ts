import { describe, it, expect, vi, beforeEach } from "vitest";
import { canPurchase } from "@/lib/access/purchase-access";

/**
 * canPurchase の判定マトリクス。
 *
 * Supabase はチェーン可能なフェイクでモックし、products / purchases の
 * .maybeSingle() 結果だけをテストごとに差し替える。決済の入口なので
 * 「誰が・何を・いくらで買えるか」の分岐を網羅しておく。
 */

type Row = Record<string, unknown> | null;

let productRow: Row = null;
let productErr: { message: string } | null = null;
let purchaseRow: Row = null;

function chain(result: () => { data: Row; error: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "limit"]) {
    c[m] = () => c;
  }
  c.maybeSingle = async () => result();
  return c;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: (table: string) =>
      table === "products"
        ? chain(() => ({ data: productRow, error: productErr }))
        : chain(() => ({ data: purchaseRow, error: null })),
  }),
}));

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const BUYER = "buyer-1";
const CREATOR = "creator-1";

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: PRODUCT_ID,
    slug: "test-product",
    title: "テスト作品",
    price_jpy: 1000,
    discount_percent: 0,
    discount_starts_at: null,
    discount_ends_at: null,
    product_type: "scenario",
    creator_id: CREATOR,
    status: "published",
    profiles: { stripe_account_id: "acct_1", stripe_charges_enabled: true },
    ...overrides,
  };
}

beforeEach(() => {
  productRow = null;
  productErr = null;
  purchaseRow = null;
});

describe("canPurchase — not_found collapse", () => {
  it("rejects a non-UUID productId without hitting the DB", async () => {
    const d = await canPurchase(BUYER, "not-a-uuid");
    expect(d).toMatchObject({ ok: false, reason: "not_found", status: 404 });
  });

  it("returns not_found when the product row is missing", async () => {
    productRow = null;
    const d = await canPurchase(BUYER, PRODUCT_ID);
    expect(d).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("hides unpublished products behind not_found", async () => {
    productRow = product({ status: "draft" });
    const d = await canPurchase(BUYER, PRODUCT_ID);
    expect(d).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("hides the creator's own product behind not_found", async () => {
    productRow = product();
    const d = await canPurchase(CREATOR, PRODUCT_ID);
    expect(d).toMatchObject({ ok: false, reason: "not_found" });
  });
});

describe("canPurchase — already purchased", () => {
  it("returns already_purchased (409) when a paid purchase exists", async () => {
    productRow = product();
    purchaseRow = { id: "p-1" };
    const d = await canPurchase(BUYER, PRODUCT_ID);
    expect(d).toMatchObject({
      ok: false,
      reason: "already_purchased",
      status: 409,
    });
  });
});

describe("canPurchase — free distribution (Stripe skipped)", () => {
  it("allows a free (price 0) product without Connect", async () => {
    productRow = product({ price_jpy: 0, profiles: null });
    const d = await canPurchase(BUYER, PRODUCT_ID);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.product.priceJpy).toBe(0);
      expect(d.product.creatorStripeAccountId).toBeNull();
    }
  });

  it("treats an active 100% discount as free distribution", async () => {
    productRow = product({ discount_percent: 100, profiles: null });
    const d = await canPurchase(BUYER, PRODUCT_ID);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.product.discountPercent).toBe(100);
      expect(d.product.creatorStripeAccountId).toBeNull();
    }
  });

  it("does NOT treat an expired 100% discount as free — full price applies", async () => {
    productRow = product({
      discount_percent: 100,
      discount_ends_at: "2020-01-01T00:00:00Z", // 過去に終了
    });
    const d = await canPurchase(BUYER, PRODUCT_ID);
    expect(d.ok).toBe(true);
    if (d.ok) {
      // 期間外 → 実効割引 0(定価)。Connect 済みなので購入可。
      expect(d.product.discountPercent).toBe(0);
      expect(d.product.creatorStripeAccountId).toBe("acct_1");
    }
  });
});

describe("canPurchase — creator Connect gate (paid only)", () => {
  it("blocks a paid product when the creator has no Stripe account", async () => {
    productRow = product({ profiles: null });
    const d = await canPurchase(BUYER, PRODUCT_ID);
    expect(d).toMatchObject({
      ok: false,
      reason: "creator_not_onboarded",
      status: 503,
    });
  });

  it("blocks a paid product when charges are not enabled yet", async () => {
    productRow = product({
      profiles: { stripe_account_id: "acct_1", stripe_charges_enabled: false },
    });
    const d = await canPurchase(BUYER, PRODUCT_ID);
    expect(d).toMatchObject({ ok: false, reason: "creator_not_onboarded" });
  });
});

describe("canPurchase — happy path", () => {
  it("returns the product with the effective discount for checkout", async () => {
    productRow = product({ discount_percent: 30 });
    const d = await canPurchase(BUYER, PRODUCT_ID);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.product).toMatchObject({
        id: PRODUCT_ID,
        priceJpy: 1000,
        discountPercent: 30,
        creatorId: CREATOR,
        creatorStripeAccountId: "acct_1",
      });
    }
  });

  it("handles the profiles join arriving as an array", async () => {
    productRow = product({
      profiles: [{ stripe_account_id: "acct_2", stripe_charges_enabled: true }],
    });
    const d = await canPurchase(BUYER, PRODUCT_ID);
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.product.creatorStripeAccountId).toBe("acct_2");
  });
});
