import type { FileFormat } from "@/lib/queries/types";

/**
 * Pure helpers for the file upload feature.
 *
 * - Size constants used by client-side early validation and server-side
 *   sanity checks (decisions.md Q8 / H-4 — the canonical enforcement is
 *   on the Supabase Storage bucket settings).
 * - MIME → extension maps used by the signed-upload-url Route Handlers
 *   to determine the file extension portion of the Storage path
 *   (`{bucket}/{creator_id}/{product_id}.{ext}` per decisions Q5 / E-1).
 *
 * Both functions return `null` for unknown or disallowed inputs so the
 * caller can reject the upload before issuing a signed URL.
 *
 * No I/O. Safe to import from anywhere (Client / Server). Covered by
 * tests/format/upload.test.ts.
 */

// ---------------------------------------------------------------------
// Size constants (bytes)
// ---------------------------------------------------------------------

/** Cover image hard cap. Matches Supabase `covers` bucket setting. */
export const COVER_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Avatar image hard cap. Matches Supabase `avatars` bucket setting
 * (0015 migration). 小さめに絞ることでストレージとロード時間を節約。
 */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Screenshot image hard cap. Matches Supabase `screenshots` bucket setting
 * (0017 migration). cover より少し大きめ(高解像度プレビュー想定)。
 */
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** 1 商品が持てるスクリーンショットの最大枚数(DB CHECK と一致)。*/
export const SCREENSHOTS_MAX_COUNT = 4;

/**
 * Product file hard cap.
 *
 * Provisional: 50 MB due to Supabase Free plan storage / egress limits.
 * Will be raised to 200 MB after migrating to the Pro plan before
 * production launch. See decisions.md H-005 for current status.
 */
export const PRODUCT_FILE_MAX_BYTES = 50 * 1024 * 1024; // 50 MB(暫定)

// ---------------------------------------------------------------------
// MIME → ext maps
// ---------------------------------------------------------------------

/** Canonical MIME types accepted for the covers bucket. */
const COVER_MIME_TO_EXT: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Resolve a Content-Type string to the file extension used in the
 * Storage path for a cover image.
 *
 * Returns `null` for unknown / disallowed MIME types. Comparison is
 * case-insensitive because browsers occasionally normalize differently.
 */
export function mimeToCoverExt(contentType: string): string | null {
  if (!contentType) return null;
  return COVER_MIME_TO_EXT[contentType.toLowerCase()] ?? null;
}

/**
 * Canonical MIME types accepted for the avatars bucket。
 * cover と同じ 3 種で十分(GIF はサポートしない、容量と表示一貫性の理由)。
 */
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

/**
 * screenshots バケット用 MIME → ext。cover / avatar と同じ 3 種。
 */
const SCREENSHOT_MIME_TO_EXT: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function mimeToScreenshotExt(contentType: string): string | null {
  if (!contentType) return null;
  return SCREENSHOT_MIME_TO_EXT[contentType.toLowerCase()] ?? null;
}

/**
 * MIME → ext map for the product-files bucket, scoped by the product's
 * declared `file_format`. The creator must pick `file_format` first
 * (in the builder) and then upload a matching file. Cross-format
 * uploads (e.g. PDF when file_format='audio') are rejected here.
 */
const PRODUCT_FILE_MIME_TO_EXT: Readonly<
  Record<FileFormat, Readonly<Record<string, string>>>
> = {
  pdf: {
    "application/pdf": "pdf",
  },
  image_zip: {
    "application/zip": "zip",
  },
  audio: {
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
  },
};

/**
 * Resolve a Content-Type + the product's declared file_format to the
 * file extension used in the Storage path.
 *
 * Returns `null` when the MIME is not allowed for that file_format,
 * for an unknown file_format, or for an empty input. Case-insensitive.
 */
export function mimeToProductFileExt(
  contentType: string,
  fileFormat: FileFormat,
): string | null {
  if (!contentType) return null;
  const allowed = PRODUCT_FILE_MIME_TO_EXT[fileFormat];
  if (!allowed) return null;
  return allowed[contentType.toLowerCase()] ?? null;
}
