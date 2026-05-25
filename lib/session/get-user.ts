import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Minimal current-user shape used across the app.
 * Replace with generated types from supabase-cli when available.
 */
export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  isCreator: boolean;
  isAdmin: boolean;
};

/**
 * Return the currently signed-in user joined with their profile, or null.
 *
 * The only place in the app that reads profiles for role decisions.
 * Other call sites should go through requireUser / requireCreator / requireAdmin.
 *
 * Cached per request (React cache) so calling it twice in one render is free.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, is_creator, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // The identity itself is confirmed by auth.getUser() above; a failure
    // to read the profile row should NOT downgrade the user to "signed out"
    // (doing so causes requireUser() to redirect to /login and creates a
    // login loop whenever profile RLS or the handle_new_user trigger
    // misbehaves). Log for diagnosis and fall through to safe defaults so
    // role checks default to "no privileges" instead of "no session".
    console.error("[get-user] profile fetch failed", error);
  }

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: profile?.display_name ?? "",
    isCreator: profile?.is_creator ?? false,
    isAdmin: profile?.is_admin ?? false,
  };
});
