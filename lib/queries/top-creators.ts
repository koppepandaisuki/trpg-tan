import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductListItem, ProductType } from "./types";

/**
 * 売上(paid purchase 数)上位クリエイターを集計し、各 creator の
 * 「ベストセラー作品」と合わせて返す。ストアフロントの「人気
 * クリエイター TOP N」セクションで使う(BBBB の延長 CCCC)。
 *
 * 集計手順:
 *  1. paid purchases を全件 select(product_id)
 *  2. 売れた products を一括 fetch(creator_id, slug, title, cover_path, ...)
 *  3. JS で:
 *     - product 別の購入数を count
 *     - creator 別の合計購入数を集計
 *     - 各 creator の中で count トップの product を「ベストセラー」と定義
 *  4. creator 合計売上 desc で上位 N 件を選定
 *  5. public_profiles を該当 ID 群で一括 fetch
 *  6. 順序を保ちつつ整形
 *
 * 失敗時は空配列で返し、呼び出し側で「セクション非表示」にする想定。
 * α 期間中の実購入がゼロのときは購入ベースでは集計できないため、空。
 *
 * 規模注意: 数千 purchases までは JS 集計で十分。それ以上は RPC へ移行。
 */

export interface TopCreatorEntry {
  rank: number;
  creator: {
    id: string;
    displayName: string;
    avatarPath: string | null;
    bio: string;
  };
  totalSales: number;
  topProduct: ProductListItem;
}

export async function getTopCreators(limit: number = 3): Promise<TopCreatorEntry[]> {
  const supabase = createClient();

  // Step 1: paid purchases
  const { data: purchases, error: purchaseErr } = await supabase
    .from("purchases")
    .select("product_id")
    .eq("status", "paid");

  if (purchaseErr) {
    console.error("[getTopCreators] purchases failed", purchaseErr);
    return [];
  }
  if (!purchases || purchases.length === 0) return [];

  // Step 2: 売れた products を一括 fetch
  const productIds = Array.from(new Set(purchases.map((p) => p.product_id)));
  const { data: productRows, error: prodErr } = await supabase
    .from("products")
    .select(
      "id, slug, title, product_type, price_jpy, discount_percent, cover_path, system_label, published_at, creator_id",
    )
    .eq("status", "published")
    .in("id", productIds);

  if (prodErr) {
    console.error("[getTopCreators] products failed", prodErr);
    return [];
  }
  if (!productRows || productRows.length === 0) return [];

  // Step 3: count per product
  const productCounts = new Map<string, number>();
  for (const p of purchases) {
    productCounts.set(p.product_id, (productCounts.get(p.product_id) ?? 0) + 1);
  }

  // creator 別の合計売上 + ベストセラー作品
  const creatorSales = new Map<string, number>();
  const creatorTopRow = new Map<string, (typeof productRows)[number]>();
  const creatorTopCount = new Map<string, number>();

  for (const row of productRows) {
    const count = productCounts.get(row.id) ?? 0;
    creatorSales.set(
      row.creator_id,
      (creatorSales.get(row.creator_id) ?? 0) + count,
    );
    const currentTop = creatorTopCount.get(row.creator_id) ?? -1;
    if (count > currentTop) {
      creatorTopCount.set(row.creator_id, count);
      creatorTopRow.set(row.creator_id, row);
    }
  }

  // Step 4: creator 合計売上 desc で上位 N
  const sortedCreatorIds = Array.from(creatorSales.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (sortedCreatorIds.length === 0) return [];

  // Step 5: profiles 一括取得
  const { data: profileRows, error: profileErr } = await supabase
    .from("public_profiles")
    .select("id, display_name, avatar_path, bio")
    .in("id", sortedCreatorIds);

  if (profileErr) {
    console.error("[getTopCreators] profiles failed", profileErr);
    return [];
  }
  const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p] as const));

  // Step 6: 順序を保ちつつ整形
  return sortedCreatorIds.flatMap((creatorId, i) => {
    const profile = profileMap.get(creatorId);
    const topRow = creatorTopRow.get(creatorId);
    if (!profile || !topRow) return [];

    const topProduct: ProductListItem = {
      id: topRow.id,
      slug: topRow.slug,
      title: topRow.title,
      productType: topRow.product_type as ProductType,
      priceJpy: topRow.price_jpy,
      discountPercent: topRow.discount_percent ?? 0,
      coverPath: topRow.cover_path,
      systemLabel: topRow.system_label,
      publishedAt: topRow.published_at,
      creator: {
        id: profile.id,
        displayName: profile.display_name ?? "",
        avatarPath: profile.avatar_path,
      },
    };

    return [
      {
        rank: i + 1,
        creator: {
          id: profile.id,
          displayName: profile.display_name ?? "",
          avatarPath: profile.avatar_path,
          bio: profile.bio ?? "",
        },
        totalSales: creatorSales.get(creatorId) ?? 0,
        topProduct,
      },
    ];
  });
}
