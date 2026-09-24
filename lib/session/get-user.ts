import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { autoGrantAdminIfWhitelisted } from "@/lib/mutations/alpha-admin";
import { normalizePlan, type UserPlan } from "@/lib/plan";

/**
 * Minimal current-user shape used across the app.
 * Replace with generated types from supabase-cli when available.
 */
export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  /**
   * テスター権限(0041 migration)。リデームコード「TESTER」で付与され、
   * Stripe を介さず月額プラン(play/pro)を無料で切り替えられる。
   * 正式リリース時にコードを止めても、既に付与済みのユーザーからは自動で
   * 剥奪されない(必要なら profiles.is_tester を個別に false へ)。
   */
  isTester: boolean;
  /** 料金プラン(0030/0031 migration)。basic / play(PLAY解放) / pro。 */
  plan: UserPlan;
};

/**
 * Return the currently signed-in user joined with their profile, or null.
 *
 * The only place in the app that reads profiles for role decisions.
 * Other call sites should go through requireUser / requireAdmin.
 *
 * Cached per request (React cache) so calling it twice in one render is free.
 *
 * 2026-09 のストア廃止で creator(出品者)ロールと Stripe Connect の状態は
 * 読まなくなった(profiles の列は残っているが UI では使わない)。
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "display_name, is_admin, is_tester, plan",
    )
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

  // α auto-grant: env `ALPHA_AUTO_ADMIN_EMAILS` に列挙されたメアドなら admin 化。
  // 副作用(DB UPDATE)を read 関数の中で行うのは通常 anti-pattern だが、
  // 冪等(既に true なら no-op)かつ React cache でリクエスト内 1 回に
  // 限定されるため許容する。env 未設定なら常に no-op。
  let isAdmin = profile?.is_admin ?? false;
  if (!isAdmin && user.email) {
    const granted = await autoGrantAdminIfWhitelisted(user.id, user.email);
    if (granted) {
      isAdmin = true;
    }
  }

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: profile?.display_name ?? "",
    isAdmin,
    isTester: profile?.is_tester ?? false,
    plan: normalizePlan(profile?.plan),
  };
});
