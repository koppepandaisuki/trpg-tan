import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * タグの集計クエリ。BuilderForm の「おすすめタグ」表示と、将来の
 * tag landing page で使う。
 *
 * 実装方針:
 *  - 本格的な集計は Supabase RPC で行うべきだが、α 期間中はデータ量が
 *    少ないので全件 select + JS 集計で十分(5000 行 cap)
 *  - 公開作品に紐づくタグだけを返したい場合は product_tags を products と
 *    JOIN して status=published で絞るべきだが、α では「下書きでも誰かが
 *    使っているタグ」を suggestion に出した方が UX 良い(creator が
 *    試した語を共有できる)。実装簡素化のため JOIN なしで集計する
 *  - 大量データ時は RPC + materialized view に置き換える想定
 *
 * 返却:
 *  - { tag, count } の配列、count desc で sort
 *  - count が同数なら tag の辞書順
 *  - limit を超えた場合は count 上位のみ
 */
export interface PopularTag {
  tag: string;
  count: number;
}

export async function getPopularTags(limit: number = 20): Promise<PopularTag[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_tags")
    .select("tag")
    .limit(5000); // 上限ガード(α 期間中は十分すぎる)

  if (error || !data) {
    if (error) console.error("[getPopularTags] failed", error);
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of data) {
    if (!row.tag) continue;
    counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag);
    })
    .slice(0, limit);
}
