import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Mutations that touch only the Storage path columns on `products`
 * (`cover_path` / `file_path`).
 *
 * Used by the signed-upload-url Route Handlers AFTER the access layer has
 * already verified ownership. We still pass `userId` and filter by
 * `creator_id` so we have three layers of defense:
 *   1. Route Handler → canUploadCover / canUploadProductFile
 *   2. RLS policy `products_update_own`
 *   3. `.eq("creator_id", userId)` here
 *
 * F-1 (decisions Q7) design: the path is written to DB immediately on
 * URL issuance, BEFORE the client PUTs the actual bytes. If the PUT
 * fails, the user re-clicks upload, gets a fresh URL for the same path,
 * and the second PUT overwrites at the same key (upsert: true). The
 * inconsistent state self-heals.
 */

export async function updateProductCoverPath(
  userId: string,
  productId: string,
  path: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ cover_path: path })
    .eq("id", productId)
    .eq("creator_id", userId);

  if (error) {
    throw new Error(`[updateProductCoverPath] failed: ${error.message}`);
  }
}

export async function updateProductFilePath(
  userId: string,
  productId: string,
  path: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ file_path: path })
    .eq("id", productId)
    .eq("creator_id", userId);

  if (error) {
    throw new Error(`[updateProductFilePath] failed: ${error.message}`);
  }
}
