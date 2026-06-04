import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * 商品のスクリーンショット一覧を order_index 昇順で取得。
 * 公開作品の screenshots は RLS で誰でも閲覧可なので anon client で OK。
 * creator は下書きの screenshots も自分のは見られる(RLS 側で許可済)。
 */
export interface ScreenshotItem {
  id: string;
  productId: string;
  orderIndex: number;
  path: string;
}

export async function listProductScreenshots(
  productId: string,
): Promise<ScreenshotItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_screenshots")
    .select("id, product_id, order_index, path")
    .eq("product_id", productId)
    .order("order_index", { ascending: true });

  if (error) {
    console.error("[listProductScreenshots] failed", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    productId: r.product_id,
    orderIndex: r.order_index,
    path: r.path,
  }));
}
