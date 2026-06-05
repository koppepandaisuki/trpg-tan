import "server-only";
import { createClient } from "@/lib/supabase/server";
import { calculateApplicationFeeJpy } from "@/lib/stripe/fees";
import type { ProductStatus } from "@/lib/format/status";

/**
 * creator の「売上・分析」(JJJJJJ)用クエリ。自分の全作品の paid 購入を
 * 集計して、作品別の売上明細 + 全体合計 + 月別推移を返す。
 *
 * 金額の考え方(D-020):
 *   - gross(総売上) = purchases.amount_jpy の合計
 *   - fee(手数料)   = purchases.application_fee_jpy の合計
 *                      (購入時点の 30% スナップショット。null の古い行は
 *                       calculateApplicationFeeJpy で補完)
 *   - net(受取額)   = gross - fee(creator の取り分 ≒ 70%)
 *
 * α 規模なら JS 集計で十分。失敗時は安全側(空)で返す。
 */

export interface CreatorSalesProductRow {
  productId: string;
  slug: string;
  title: string;
  coverPath: string | null;
  status: ProductStatus;
  salesCount: number;
  grossJpy: number;
  feeJpy: number;
  netJpy: number;
  /** その作品の最終販売日(売上 0 なら null)*/
  lastSoldAt: string | null;
}

export interface CreatorMonthlySales {
  /** "YYYY-MM" */
  month: string;
  salesCount: number;
  grossJpy: number;
  netJpy: number;
}

export interface CreatorSalesBreakdown {
  totals: {
    salesCount: number;
    grossJpy: number;
    feeJpy: number;
    netJpy: number;
  };
  /** 受取額(net)の降順。売上 0 の作品も含む(末尾に並ぶ)*/
  products: CreatorSalesProductRow[];
  /** 月別推移(新しい順、最大 6 ヶ月)*/
  monthly: CreatorMonthlySales[];
  /** 集計に含めた作品数(= 自分の全作品数)*/
  productCount: number;
}

export async function getCreatorSalesBreakdown(
  userId: string,
): Promise<CreatorSalesBreakdown> {
  const supabase = createClient();

  // Step 1: 自分の products
  const { data: productRows, error: prodErr } = await supabase
    .from("products")
    .select("id, slug, title, status, cover_path")
    .eq("creator_id", userId);

  if (prodErr) {
    console.error("[getCreatorSalesBreakdown] products failed", prodErr);
    return emptyBreakdown();
  }

  const products = productRows ?? [];
  if (products.length === 0) {
    return emptyBreakdown();
  }

  const productIds = products.map((p) => p.id);

  // Step 2: 自作品の paid purchases(金額 + 手数料 + 日付)
  const { data: purchaseRows, error: purErr } = await supabase
    .from("purchases")
    .select("product_id, amount_jpy, application_fee_jpy, paid_at")
    .eq("status", "paid")
    .in("product_id", productIds);

  if (purErr) {
    console.error("[getCreatorSalesBreakdown] purchases failed", purErr);
  }

  // 作品別アキュムレータ初期化
  const perProduct = new Map<
    string,
    {
      salesCount: number;
      grossJpy: number;
      feeJpy: number;
      lastSoldAt: string | null;
    }
  >();
  for (const id of productIds) {
    perProduct.set(id, {
      salesCount: 0,
      grossJpy: 0,
      feeJpy: 0,
      lastSoldAt: null,
    });
  }

  // 月別アキュムレータ
  const perMonth = new Map<
    string,
    { salesCount: number; grossJpy: number; netJpy: number }
  >();

  let totalSales = 0;
  let totalGross = 0;
  let totalFee = 0;

  for (const row of purchaseRows ?? []) {
    const gross = row.amount_jpy ?? 0;
    // 手数料スナップショットが無い古い行は推定値で補完
    const fee = row.application_fee_jpy ?? calculateApplicationFeeJpy(gross);
    const net = gross - fee;

    const acc = perProduct.get(row.product_id);
    if (acc) {
      acc.salesCount++;
      acc.grossJpy += gross;
      acc.feeJpy += fee;
      if (!acc.lastSoldAt || row.paid_at > acc.lastSoldAt) {
        acc.lastSoldAt = row.paid_at;
      }
    }

    totalSales++;
    totalGross += gross;
    totalFee += fee;

    // 月別("YYYY-MM")
    const month =
      typeof row.paid_at === "string" && row.paid_at.length >= 7
        ? row.paid_at.slice(0, 7)
        : "unknown";
    const m = perMonth.get(month) ?? { salesCount: 0, grossJpy: 0, netJpy: 0 };
    m.salesCount++;
    m.grossJpy += gross;
    m.netJpy += net;
    perMonth.set(month, m);
  }

  // 作品別行を組み立て、net 降順 → 同点は売上数降順でソート
  const productMeta = new Map(products.map((p) => [p.id, p] as const));
  const productRowsOut: CreatorSalesProductRow[] = productIds.map((id) => {
    const p = productMeta.get(id)!;
    const acc = perProduct.get(id)!;
    return {
      productId: id,
      slug: p.slug,
      title: p.title,
      coverPath: p.cover_path,
      status: p.status as ProductStatus,
      salesCount: acc.salesCount,
      grossJpy: acc.grossJpy,
      feeJpy: acc.feeJpy,
      netJpy: acc.grossJpy - acc.feeJpy,
      lastSoldAt: acc.lastSoldAt,
    };
  });
  productRowsOut.sort(
    (a, b) => b.netJpy - a.netJpy || b.salesCount - a.salesCount,
  );

  // 月別(新しい順、最大 6 ヶ月)
  const monthly: CreatorMonthlySales[] = Array.from(perMonth.entries())
    .filter(([month]) => month !== "unknown")
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => (a.month < b.month ? 1 : -1))
    .slice(0, 6);

  return {
    totals: {
      salesCount: totalSales,
      grossJpy: totalGross,
      feeJpy: totalFee,
      netJpy: totalGross - totalFee,
    },
    products: productRowsOut,
    monthly,
    productCount: products.length,
  };
}

function emptyBreakdown(): CreatorSalesBreakdown {
  return {
    totals: { salesCount: 0, grossJpy: 0, feeJpy: 0, netJpy: 0 },
    products: [],
    monthly: [],
    productCount: 0,
  };
}
