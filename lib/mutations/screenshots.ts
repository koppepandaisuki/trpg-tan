import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * product_screenshots に新しい行を upsert する(同じ product_id + order_index
 * があれば path を上書き)。RLS で creator 自身の商品行だけ insert/update
 * 可能。失敗時は throw。
 */
export async function upsertProductScreenshot(args: {
  productId: string;
  orderIndex: number;
  path: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("product_screenshots").upsert(
    {
      product_id: args.productId,
      order_index: args.orderIndex,
      path: args.path,
    },
    { onConflict: "product_id,order_index" },
  );
  if (error) {
    console.error("[upsertProductScreenshot] failed", error);
    throw new Error(`upsertProductScreenshot failed: ${error.message}`);
  }
}

/**
 * 1 件のスクリーンショット行を削除。RLS で creator 自身のみ。
 */
export async function deleteProductScreenshot(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("product_screenshots")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[deleteProductScreenshot] failed", error);
    throw new Error(`deleteProductScreenshot failed: ${error.message}`);
  }
}
