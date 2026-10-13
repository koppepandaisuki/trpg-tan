/**
 * Pure helpers for avatar uploads.
 *
 * - Size cap used by client-side early validation and server-side sanity
 *   checks (the canonical enforcement is the Supabase Storage bucket setting).
 * - MIME → extension map used by the signed-upload-url Route Handler to
 *   decide the file extension portion of the Storage path.
 *
 * 2026-09 のストア廃止で、表紙・スクリーンショット・作品ファイル用の定数と
 * 変換は撤去した(アバターだけが残る)。
 *
 * No I/O. Safe to import from anywhere (Client / Server).
 */

/**
 * Avatar image hard cap. Matches Supabase `avatars` bucket setting
 * (0015 migration). 小さめに絞ることでストレージとロード時間を節約。
 */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const AVATAR_MIME_TO_EXT: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Resolve a Content-Type string to the file extension used in the
 * Storage path for an avatar image. Returns `null` for unknown MIME.
 */
export function mimeToAvatarExt(contentType: string): string | null {
  if (!contentType) return null;
  return AVATAR_MIME_TO_EXT[contentType.toLowerCase()] ?? null;
}
