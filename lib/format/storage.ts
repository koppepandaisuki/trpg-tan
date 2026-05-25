import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolve a Storage path to a public URL.
 *
 * Only `covers` and `avatars` are public buckets. `product-files` must NEVER
 * be resolved this way — those files require a signed URL issued by an
 * authenticated server route in Phase 6.
 *
 * Returns null when the path is missing so callers can fall back to a
 * placeholder UI.
 */
export function publicCoverUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const supabase = createClient();
  const { data } = supabase.storage.from("covers").getPublicUrl(path);
  return data.publicUrl;
}

export function publicAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const supabase = createClient();
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
