/**
 * Same-origin path sanitizers.
 *
 * Pure helpers shared by login redirects, auth callback, and the checkout
 * cancel page. Reject:
 *   - empty / null / undefined
 *   - paths that don't start with "/"
 *   - protocol-relative paths "//..." (open-redirect vector)
 *
 * Returns a safe internal path or the provided fallback.
 */
export function sanitizeInternalPath(
  next: string | null | undefined,
  fallback: string,
): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  return next;
}

/** Convenience: same as sanitizeInternalPath but defaults to "/". */
export function safeNext(next: string | null | undefined): string {
  return sanitizeInternalPath(next, "/");
}

/**
 * Allow only product slugs that match our slug shape.
 * Empty string is returned for anything else so callers can detect and
 * fall back to a generic destination.
 */
export function sanitizeSlug(slug: string | null | undefined): string {
  if (!slug || typeof slug !== "string") return "";
  if (slug.length === 0 || slug.length > 80) return "";
  if (!/^[a-z0-9-]+$/i.test(slug)) return "";
  return slug;
}
