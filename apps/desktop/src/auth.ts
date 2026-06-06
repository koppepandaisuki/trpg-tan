import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { openUrl } from "@tauri-apps/plugin-opener";
import { supabase } from "./supabase";

/**
 * デスクトップ認証(deep-link OAuth/PKCE)。
 *
 * フロー:
 *  1. signInWithGoogle() が Supabase の認可URLを生成(skipBrowserRedirect)し、
 *     システムブラウザで開く。redirectTo は custom scheme。
 *  2. ユーザーがブラウザでログイン → Supabase が paradice://auth/callback?code=… へ。
 *  3. Tauri deep-link がそのURLを受け取り、code をセッションに交換。
 *
 * PKCE の code_verifier は supabase-js が localStorage に保持するため、
 * 同一アプリ内で開始→交換すれば成立する。
 */

const REDIRECT_TO = "paradice://auth/callback";

export async function signInWithGoogle(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: REDIRECT_TO, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (data?.url) await openUrl(data.url);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * deep-link コールバックの登録。アプリ起動時に 1 度だけ呼ぶ。
 * paradice://auth/callback?code=… を受けて exchangeCodeForSession する。
 */
export async function initDeepLinkAuth(): Promise<void> {
  await onOpenUrl(async (urls) => {
    for (const raw of urls) {
      if (!raw.startsWith("paradice://auth/callback")) continue;
      try {
        const parsed = new URL(raw);
        const code = parsed.searchParams.get("code");
        const errDesc = parsed.searchParams.get("error_description");
        if (errDesc) {
          console.error("[auth] callback error:", errDesc);
          continue;
        }
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) console.error("[auth] exchange failed:", error.message);
        }
      } catch (e) {
        console.error("[auth] deep-link handling failed:", e);
      }
    }
  });
}
