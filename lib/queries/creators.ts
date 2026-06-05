import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * 公開作品を 1 つ以上持つクリエイターの一覧を返す。
 *
 * 集計手順:
 *  1. published な products から creator_id ごとの作品数を集計
 *     (JS 側で reduce、α 期間中はデータ量が少ないので RPC 不要)
 *  2. 作品数の多い順に並べ替え
 *  3. ページング適用
 *  4. 該当する creator_id 群の public_profiles を一括 fetch
 *  5. 順序を保ちつつ整形
 *
 * 失敗時はすべて空配列で返す(部分エラーでクラッシュさせない)。
 *
 * 将来的に creators が増えたら materialized view + RPC で集計を
 * server-side に持っていく想定。
 */

export interface CreatorListItem {
  id: string;
  displayName: string;
  avatarPath: string | null;
  bio: string;
  productCount: number;
  /** sort="sales" のときに集計される。それ以外は 0。*/
  totalSales: number;
}

export interface CreatorListResult {
  items: CreatorListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const CREATORS_PAGE_SIZE = 24;

export type CreatorSort = "products" | "sales";

export async function listPublicCreators(opts?: {
  page?: number;
  sort?: CreatorSort;
  /** display_name 部分一致検索(OOOOO)。空は無視。*/
  q?: string | null;
}): Promise<CreatorListResult> {
  const supabase = createClient();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = CREATORS_PAGE_SIZE;
  const sort: CreatorSort = opts?.sort ?? "products";
  const q = opts?.q?.trim() || null;

  // Step 1: published な作品の creator_id と product_id を取得
  // (作品数の集計 + sales 集計時の product → creator 紐付けに使う)
  const { data: productRows, error: prodErr } = await supabase
    .from("products")
    .select("id, creator_id")
    .eq("status", "published")
    .limit(5000);

  if (prodErr) {
    console.error("[listPublicCreators] products failed", prodErr);
    return { items: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const countByCreator = new Map<string, number>();
  const productToCreator = new Map<string, string>();
  for (const row of productRows ?? []) {
    countByCreator.set(
      row.creator_id,
      (countByCreator.get(row.creator_id) ?? 0) + 1,
    );
    productToCreator.set(row.id, row.creator_id);
  }

  // Step 1.5: 検索(OOOOO)。display_name 部分一致の creator id 集合で
  // countByCreator を絞り込む。total / sort / page もこの絞り込み後の
  // 母集合で計算される。
  if (q) {
    const { data: matchRows, error: matchErr } = await supabase
      .from("public_profiles")
      .select("id")
      .ilike("display_name", `%${q}%`)
      .limit(5000);
    if (matchErr) {
      console.error("[listPublicCreators] search failed", matchErr);
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }
    const matchSet = new Set((matchRows ?? []).map((r) => r.id));
    for (const id of Array.from(countByCreator.keys())) {
      if (!matchSet.has(id)) countByCreator.delete(id);
    }
  }

  const total = countByCreator.size;
  if (total === 0) {
    return { items: [], total: 0, page, pageSize, totalPages: 0 };
  }

  // Step 2: sales sort の場合、paid purchases から creator 別売上を集計
  const salesByCreator = new Map<string, number>();
  if (sort === "sales") {
    const { data: purchaseRows, error: purchaseErr } = await supabase
      .from("purchases")
      .select("product_id")
      .eq("status", "paid");
    if (purchaseErr) {
      console.error("[listPublicCreators] purchases failed", purchaseErr);
      // 部分エラーでも products 順にフォールバックして続行(空回避)
    }
    for (const p of purchaseRows ?? []) {
      const creatorId = productToCreator.get(p.product_id);
      if (!creatorId) continue;
      salesByCreator.set(
        creatorId,
        (salesByCreator.get(creatorId) ?? 0) + 1,
      );
    }
  }

  // Step 3: 指定された並び順で sort
  // - "products" → 作品数 desc、同点は id 安定順
  // - "sales"    → 売上 desc、同点は作品数 desc → id 順
  const sortedIds = Array.from(countByCreator.keys()).sort((a, b) => {
    if (sort === "sales") {
      const sa = salesByCreator.get(a) ?? 0;
      const sb = salesByCreator.get(b) ?? 0;
      if (sa !== sb) return sb - sa;
    }
    const ca = countByCreator.get(a) ?? 0;
    const cb = countByCreator.get(b) ?? 0;
    if (ca !== cb) return cb - ca;
    return a.localeCompare(b);
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  const pageIds = sortedIds.slice(from, to);

  if (pageIds.length === 0) {
    return { items: [], total, page, pageSize, totalPages };
  }

  // Step 4: public_profiles を一括 fetch
  const { data: profileRows, error: profileErr } = await supabase
    .from("public_profiles")
    .select("id, display_name, avatar_path, bio")
    .in("id", pageIds);

  if (profileErr) {
    console.error("[listPublicCreators] profiles failed", profileErr);
    return { items: [], total, page, pageSize, totalPages };
  }

  const profileMap = new Map(
    (profileRows ?? []).map((r) => [r.id, r] as const),
  );

  // Step 5: pageIds の順序を保ちつつ整形
  const items: CreatorListItem[] = pageIds.flatMap((id) => {
    const profile = profileMap.get(id);
    if (!profile) return [];
    return [
      {
        id,
        displayName: profile.display_name ?? "",
        avatarPath: profile.avatar_path,
        bio: profile.bio ?? "",
        productCount: countByCreator.get(id) ?? 0,
        totalSales: salesByCreator.get(id) ?? 0,
      },
    ];
  });

  return { items, total, page, pageSize, totalPages };
}
