import { onOpenUrl, getCurrent } from "@tauri-apps/plugin-deep-link";
import { openExternalUrl as openUrl, WEB_BASE, isTauri } from "./platform";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { supabase } from "./supabase";
import { toast } from "./Toasts";

/**
 * ログイン成功をユーザーに即時フィードバックする。deep-link は裏で届くため、
 * これが無いと「反映されたのか分からない」体験になる。ウィンドウ前面化は
 * Rust 側(single-instance)でも行うが、macOS の onOpenUrl 経路や dev 用に
 * JS 側でも保険をかける。
 */
async function announceLogin(): Promise<void> {
  toast("✅ ログインしました");
  try {
    const win = getCurrentWindow();
    await win.show();
    await win.unminimize();
    await win.setFocus();
  } catch {
    // ブラウザプレビュー等、Tauri IPC が無い環境では無視。
  }
}

/**
 * デスクトップ認証(deep-link 経由のセッション受け渡し / PKCE)。
 *
 * **基本方針:ログインは常に web のログイン画面をシステムブラウザで開く。**
 * こうすると 1 回のログインで「ブラウザ(=web の Cookie セッション)」と
 * 「デスクトップ(=WebView の localStorage セッション)」の両方が確立し、
 * web とアプリのどちらでログインしても両方ログイン済みになる。
 * web 画面はメール/パスワードと Google の両方を備えるので、アプリ側も
 * 追加 UI なしで両方式に対応できる。
 *
 * フロー:
 *  1. openWebLogin() が `${WEB_BASE}/login?next=/auth/desktop-handoff` を
 *     システムブラウザで開く。
 *  2. ユーザーがブラウザでログイン(メール/パス or Google)。
 *  3. web の /auth/desktop-handoff が、確立したセッションの access/refresh
 *     トークンを `redice://auth/callback#access_token=…&refresh_token=…`
 *     に載せてディープリンクで返す。
 *  4. Tauri deep-link がその URL を受け取り setSession でアプリにも反映。
 *
 * 互換: 旧来の in-app Google(signInWithGoogle)が返す `?code=…` 形式の
 * コールバックも引き続き exchangeCodeForSession で処理する。
 * 旧ブランドの `paradice://` も受理し続ける(旧バージョンの web からの戻りや
 * 古いリンクを壊さない。tauri.conf.json でスキーム登録も両方維持)。
 *
 * single-instance プラグインと組み合わせることで、OS が redice:// を受け取った
 * とき新しいプロセスが起動せず、既存ウィンドウの onOpenUrl に直接届く。
 */

const REDIRECT_TO = "redice://auth/callback";

// WEB_BASE は platform.ts(Tauri=env / ブラウザ=同一オリジン相対)

/** web 側でログイン後にトークンをアプリへ返してもらう中継ページ。
 *  - Tauri: /auth/desktop-handoff → redice:// deep-link で返す
 *  - ブラウザ(PWA): /auth/app-handoff → /app/#access_token=… へ
 *    リダイレクトで返す(同一オリジン。トークンはフラグメントなので
 *    サーバーへは送られない) */
const HANDOFF_PATH = "/auth/desktop-handoff";
const BROWSER_HANDOFF_PATH = "/auth/app-handoff";

/**
 * web のログイン画面を開く。Tauri はシステムブラウザ + deep-link 戻り、
 * ブラウザ(PWA)は同一タブ遷移 + /app/ へのリダイレクト戻り。
 * 既に web にログイン済みなら handoff へ直行するので、実質ワンクリックで
 * アプリにもセッションが入る。
 */
export async function openWebLogin(): Promise<void> {
  if (!isTauri()) {
    window.location.href = `${WEB_BASE}/login?next=${encodeURIComponent(BROWSER_HANDOFF_PATH)}`;
    return;
  }
  const url = `${WEB_BASE}/login?next=${encodeURIComponent(HANDOFF_PATH)}`;
  await openUrl(url);
}

/** web の新規登録画面を開く(handoff 付き)。 */
export async function openWebSignup(): Promise<void> {
  if (!isTauri()) {
    window.location.href = `${WEB_BASE}/signup?next=${encodeURIComponent(BROWSER_HANDOFF_PATH)}`;
    return;
  }
  const url = `${WEB_BASE}/signup?next=${encodeURIComponent(HANDOFF_PATH)}`;
  await openUrl(url);
}

/**
 * ブラウザ(PWA)起動時: /auth/app-handoff から `#access_token=…&
 * refresh_token=…&type=app-handoff` で戻ってきたらセッションを確立する。
 * 処理後は履歴からフラグメントを消す(トークンを URL に残さない)。
 */
export async function initBrowserHandoffAuth(): Promise<void> {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) return;
  const hp = new URLSearchParams(hash);
  if (hp.get("type") !== "app-handoff") return;
  const accessToken = hp.get("access_token");
  const refreshToken = hp.get("refresh_token");
  // 先に URL からトークンを消す(setSession の成否に関わらず残さない)。
  window.history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search,
  );
  if (!accessToken || !refreshToken) return;
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) console.error("[auth] browser handoff failed:", error.message);
  else {
    console.info("[auth] login success (browser handoff)");
    void announceLogin();
  }
}

/**
 * 旧来の in-app Google ログイン(PKCE)。アプリ単体でのみセッションが立つため
 * web とは共有されない。現在は openWebLogin() を主導線にしているが、後方互換
 * とフォールバックのために残す。
 */
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
  // プランのオフライン用キャッシュを破棄(前アカウントの権限を持ち越さない)。
  // 循環 import を避けるため動的 import。
  const { clearAccountCache } = await import("./account-remote");
  clearAccountCache();
  const { clearGoldBalance } = await import("./gold-remote");
  clearGoldBalance();
}

// 同じ認可コードを複数経路(getCurrent / onOpenUrl / deep-link-url イベント)で
// 受け取っても二重に交換しないためのガード。
const processedCodes = new Set<string>();

/**
 * redice://auth/callback(旧 paradice:// も可)を受けてセッションを確立する
 * 共通処理。2 形式に対応:
 *  (A) フラグメント `#access_token=…&refresh_token=…`(web からの handoff)
 *      → setSession でそのまま反映。web とアプリ両方がログイン済みになる。
 *  (B) クエリ `?code=…`(旧来の in-app Google PKCE)
 *      → exchangeCodeForSession で交換。
 */
async function handleCallbackUrl(raw: string): Promise<void> {
  if (
    !raw.startsWith("redice://auth/callback") &&
    !raw.startsWith("paradice://auth/callback")
  )
    return;
  try {
    const parsed = new URL(raw);
    const errDesc = parsed.searchParams.get("error_description");
    if (errDesc) {
      console.error("[auth] callback error:", errDesc);
      return;
    }

    // (A) web ログイン画面からのトークン handoff(フラグメント)。
    const hash = parsed.hash.startsWith("#")
      ? parsed.hash.slice(1)
      : parsed.hash;
    if (hash) {
      const hp = new URLSearchParams(hash);
      const accessToken = hp.get("access_token");
      const refreshToken = hp.get("refresh_token");
      if (accessToken && refreshToken) {
        // 同じトークンの二重適用を防ぐ(先頭で十分に一意)。
        const guard = accessToken.slice(0, 32);
        if (processedCodes.has(guard)) return;
        processedCodes.add(guard);
        console.info("[auth] applying session from web handoff…");
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) console.error("[auth] setSession failed:", error.message);
        else {
          console.info("[auth] login success (handoff)");
          void announceLogin();
        }
        return;
      }
    }

    // (B) 旧来の in-app Google PKCE(?code=…)。
    const code = parsed.searchParams.get("code");
    if (!code) {
      console.warn("[auth] callback without token/code:", raw);
      return;
    }
    if (processedCodes.has(code)) return; // 二重交換を防ぐ
    processedCodes.add(code);
    console.info("[auth] exchanging code for session…");
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.error("[auth] exchange failed:", error.message);
    else {
      console.info("[auth] login success");
      void announceLogin();
    }
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
