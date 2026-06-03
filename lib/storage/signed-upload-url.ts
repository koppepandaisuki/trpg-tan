import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Signed upload URL issuance for the upload feature (Ph-γ).
 *
 * Only place in the codebase that calls `createSignedUploadUrl` against
 * Supabase Storage. Pairs with `lib/storage/signed-url.ts` (download
 * side); both use `service_role` and live behind `import "server-only"`.
 *
 * Authorization is the caller's responsibility (see
 * lib/access/upload-access.ts). signed URLs bypass Storage RLS, so the
 * access check is the only gate before this function runs.
 *
 * About the URL TTL:
 *   @supabase/supabase-js@^2.45 exposes only `{ upsert }` on
 *   createSignedUploadUrl. The URL's own validity is fixed server-side by
 *   Supabase (default ~2 h, not user-configurable from the SDK). The
 *   Route Handlers advertise `expiresIn: 300` to the client as the
 *   intended use-by window (decisions Q10 / J-E). Clients should start
 *   the PUT within 5 minutes; if SDK gains a TTL option in a future
 *   version, this comment + the route handlers should be updated together.
 *
 * `upsert: true` is mandatory: the F-1 self-heal path requires the
 * client to be able to overwrite the same `{creator_id}/{product_id}.{ext}`
 * key on retry.
 */

const COVERS_BUCKET = "covers";
const PRODUCT_FILES_BUCKET = "product-files";
const AVATARS_BUCKET = "avatars";

export async function createCoverUploadUrl(path: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(COVERS_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data?.signedUrl) {
    throw new Error(
      `[createCoverUploadUrl] failed: ${error?.message ?? "no url"}`,
    );
  }
  return data.signedUrl;
}

export async function createProductFileUploadUrl(
  path: string,
): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(PRODUCT_FILES_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data?.signedUrl) {
    throw new Error(
      `[createProductFileUploadUrl] failed: ${error?.message ?? "no url"}`,
    );
  }
  return data.signedUrl;
}

/**
 * アバター画像用 signed upload URL。avatars バケットは public-read かつ
 * 自分のフォルダ(<user_id>/...)にのみ書き込み可能。
 *
 * upsert: true で 同じ path への再アップロードを許可(プロフィール画像の
 * 差し替えで使う、creator が何度も変えても新規 path が乱立しない設計)。
 */
export async function createAvatarUploadUrl(path: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(AVATARS_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data?.signedUrl) {
    throw new Error(
      `[createAvatarUploadUrl] failed: ${error?.message ?? "no url"}`,
    );
  }
  return data.signedUrl;
}
