import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * 商品 1 件の paid purchase 数を返す。商品詳細の「販売情報」セクション
 * 表示用の軽量クエリ。
 *
 * `head: true` + `count: "exact"` で行データを取らずに COUNT だけ取得する。
 * 失敗時は 0 を返し、UI は「販売情報を未取得」相当として扱う(セクション
 * ごと非表示にする呼び出し側の判断に任せる)。
 */
export async function getProductSalesCount(productId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("purchases")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("status", "paid");

  if (error) {
    console.error("[getProductSalesCount] failed", error);
    return 0;
  }
  return count ?? 0;
}
