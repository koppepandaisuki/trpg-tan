import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolve an avatar Storage path to its public URL.
 *
 * Returns null when the path is missing so callers can fall back to a
 * placeholder UI.
 */
export function publicAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const supabase = createClient();
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
