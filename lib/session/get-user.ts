import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { autoGrantCreatorIfWhitelisted } from "@/lib/mutations/alpha-creator";

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
 *
 * α 期間限定:env `ALPHA_AUTO_CREATOR_EMAILS` にメアドが含まれていれば、
 * 初回ログイン時に自動で `is_creator = true` を付与する。詳細は
 * `lib/access/alpha-whitelist.ts` / `lib/mutations/alpha-creator.ts`。
 * Phase 2 で creator 申請 UI が実装されたら関連コードごと削除予定。
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

  let isCreator = profile?.is_creator ?? false;

  // α auto-grant: env に列挙されたメアドなら自動で creator 化。
  // 副作用(DB UPDATE)を read 関数の中で行うのは通常 anti-pattern だが、
  // 冪等(既に true なら no-op)かつ React cache でリクエスト内 1 回に
  // 限定されるため許容する。Phase 2 で creator 申請 UI を実装したら除去。
  if (!isCreator && user.email) {
    const granted = await autoGrantCreatorIfWhitelisted(user.id, user.email);
    if (granted) {
      isCreator = true;
    }
  }

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: profile?.display_name ?? "",
    isCreator,
    isAdmin: profile?.is_admin ?? false,
  };
});
