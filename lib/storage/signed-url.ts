import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Signed URL issuance for private Storage buckets.
 *
 * THIS is the only place in Phase 6 that touches `service_role`.
 * Callers are responsible for any access control (ownership, status,
 * purchases) BEFORE calling this — see lib/access/library-access.ts.
 *
 * Short TTL (default 120s) per Phase 6 design. The product-files bucket
 * has no public read policy, so the signed URL is the only way out.
 */

const PRODUCT_FILES_BUCKET = "product-files";

export async function createProductFileSignedUrl(
  filePath: string,
  expiresInSec = 120,
): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(PRODUCT_FILES_BUCKET)
    .createSignedUrl(filePath, expiresInSec);

  if (error || !data?.signedUrl) {
    throw new Error(
      `[createProductFileSignedUrl] failed: ${error?.message ?? "no url"}`,
    );
  }
  return data.signedUrl;
}
