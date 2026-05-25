/**
 * Slug generation helpers.
 *
 * `slugify(title)` builds a URL-safe slug from a free-form title.
 *   - lowercases
 *   - replaces whitespace / underscores with a single hyphen
 *   - drops anything outside [a-z0-9-]
 *   - collapses repeated hyphens
 *   - trims leading/trailing hyphens
 *   - caps length at 60 characters
 *   - falls back to randomToken() when the result would be empty
 *
 * Uniqueness against the database is the caller's responsibility (see
 * generateUniqueSlug in lib/mutations/creator-products.ts).
 */

const MAX_SLUG_LENGTH = 60;

export function slugify(title: string): string {
  if (typeof title !== "string") return randomToken();
  const base = title
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (base.length === 0) return randomToken();
  if (base.length > MAX_SLUG_LENGTH) {
    return base.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, "");
  }
  return base;
}

/** 8-char hex token. Globally available in Node 19+ / modern browsers. */
export function randomToken(): string {
  return globalThis.crypto.randomUUID().slice(0, 8);
}
