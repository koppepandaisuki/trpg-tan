import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Signed upload URL issuance (avatars).
 *
 * signed URLs bypass Storage RLS, so the caller's auth check is the only
 * gate before this runs (app/api/account/avatar-upload-url).
 *
 * 2026-09 のストア廃止で、表紙・作品ファイル・スクリーンショット用の発行は
 * 撤去した。
 */

const AVATARS_BUCKET = "avatars";

/**
 * プロフィール画像用 signed upload URL。avatars バケットは public-read かつ
 * 自分のフォルダ(<user_id>/...)にのみ書き込み可能。
 *
 * upsert: true で同じ path への再アップロードを許可(差し替えのたびに
 * 新しい path が乱立しないように)。
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
