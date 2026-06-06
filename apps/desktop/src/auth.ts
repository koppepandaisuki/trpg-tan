import { onOpenUrl, getCurrent } from "@tauri-apps/plugin-deep-link";
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
 *
 * single-instance プラグインと組み合わせることで、OS が paradice:// を受け取った
 * とき新しいプロセスが起動せず、既存ウィンドウの onOpenUrl に直接届く。
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

/** paradice://auth/callback?code=… を受けて exchangeCodeForSession する共通処理 */
async function handleCallbackUrl(raw: string): Promise<void> {
  if (!raw.startsWith("paradice://auth/callback")) return;
  try {
    const parsed = new URL(raw);
    const errDesc = parsed.searchParams.get("error_description");
    if (errDesc) {
      console.error("[auth] callback error:", errDesc);
      return;
    }
    const code = parsed.searchParams.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) console.error("[auth] exchange failed:", error.message);
    }
  } catch (e) {
    console.error("[auth] deep-link handling failed:", e);
  }
}

/**
 * deep-link コールバックの登録。アプリ起動時に 1 度だけ呼ぶ。
 *
 * getCurrent()  → このインスタンスが起動時に受け取った URL を処理
 * onOpenUrl()   → 起動後に既存インスタンスへ転送された URL を処理
 * (single-instance があれば後者だけ使われるが、両方登録しておく)
 */
export async function initDeepLinkAuth(): Promise<void> {
  // 起動時 URL(アプリが deep-link で起動した場合)
  const initial = await getCurrent();
  if (initial) {
    for (const url of initial) {
      await handleCallbackUrl(url);
    }
  }

  // 既存インスタンスへの転送(single-instance + deep-link の通常ケース)
  await onOpenUrl(async (urls) => {
    for (const raw of urls) {
      await handleCallbackUrl(raw);
    }
  });
}
