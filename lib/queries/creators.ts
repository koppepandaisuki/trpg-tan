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
}

export interface CreatorListResult {
  items: CreatorListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const CREATORS_PAGE_SIZE = 24;

export async function listPublicCreators(opts?: {
  page?: number;
}): Promise<CreatorListResult> {
  const supabase = createClient();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = CREATORS_PAGE_SIZE;

  // Step 1: published な作品の creator_id を全件取得して集計
  // (alpha 期間はデータ量少ないので select all → reduce で十分。
  //  数千件以上になったら RPC に置換)
  const { data: productRows, error: prodErr } = await supabase
    .from("products")
    .select("creator_id")
    .eq("status", "published")
    .limit(5000);

  if (prodErr) {
    console.error("[listPublicCreators] products failed", prodErr);
    return { items: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const countByCreator = new Map<string, number>();
  for (const row of productRows ?? []) {
    countByCreator.set(
      row.creator_id,
      (countByCreator.get(row.creator_id) ?? 0) + 1,
    );
  }

  const total = countByCreator.size;
  if (total === 0) {
    return { items: [], total: 0, page, pageSize, totalPages: 0 };
  }

  // Step 2: 作品数の多い順に並べ替え + ページ範囲を抽出
  const sortedIds = Array.from(countByCreator.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  const pageIds = sortedIds.slice(from, to);

  if (pageIds.length === 0) {
    return { items: [], total, page, pageSize, totalPages };
  }

  // Step 3: public_profiles を一括 fetch
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

  // Step 4: pageIds の順序を保ちつつ整形
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
      },
    ];
  });

  return { items, total, page, pageSize, totalPages };
}
