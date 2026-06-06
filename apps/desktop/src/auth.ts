import { onOpenUrl, getCurrent } from "@tauri-apps/plugin-deep-link";
import { openUrl } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";
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

// 同じ認可コードを複数経路(getCurrent / onOpenUrl / deep-link-url イベント)で
// 受け取っても二重に交換しないためのガード。
const processedCodes = new Set<string>();

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
    if (!code) {
      console.warn("[auth] callback without code:", raw);
      return;
    }
    if (processedCodes.has(code)) return; // 二重交換を防ぐ
    processedCodes.add(code);
    console.info("[auth] exchanging code for session…");
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.error("[auth] exchange failed:", error.message);
    else console.info("[auth] login success");
  } catch (e) {
    console.error("[auth] deep-link handling failed:", e);
  }
}

/**
 * deep-link コールバックの登録。アプリ起動時に 1 度だけ呼ぶ。3 経路を張る:
 *
 *  1. getCurrent()         … アプリが deep-link で *起動* した場合(コールドスタート)
 *  2. deep-link-url イベント … 起動後、single-instance が argv から拾って emit(dev で主役)
 *  3. onOpenUrl()          … deep-link プラグインの自動発火(本番/ macOS 向け)
 *
 * 同じ code は processedCodes でガードするので、複数経路で届いても安全。
 */
export async function initDeepLinkAuth(): Promise<void> {
  // 1. 起動時 URL(アプリが deep-link で起動した場合)
  try {
    const initial = await getCurrent();
    if (initial) {
      for (const url of initial) await handleCallbackUrl(url);
    }
  } catch (e) {
    console.error("[auth] getCurrent failed:", e);
  }

  // 2. single-instance が転送した URL(実行時登録の dev では実質ここが本命)
  await listen<string>("deep-link-url", (event) => {
    void handleCallbackUrl(event.payload);
  });

  // 3. deep-link プラグインの自動発火(本番インストール版 / macOS)
  await onOpenUrl(async (urls) => {
    for (const raw of urls) await handleCallbackUrl(raw);
  });
}
