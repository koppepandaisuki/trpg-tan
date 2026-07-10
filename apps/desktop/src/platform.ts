import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { openUrl as tauriOpenUrl } from "@tauri-apps/plugin-opener";
import { isTauri } from "./storage";

/**
 * 実行環境(Tauri / ブラウザ=PWA)の差を吸収する適応層。
 *
 * 同じフロントエンドを
 *   - デスクトップ: Tauri WebView(HTTP は plugin-http で CORS 回避、
 *     外部リンクは plugin-opener でシステムブラウザへ)
 *   - スマホ: ブラウザ/PWA(web と同一オリジンの /app/ で配信するので
 *     HTTP は素の fetch で足りる。外部リンクは通常のタブ遷移)
 * で動かすため、HTTP / URL オープン / API ベース URL をここに集約する。
 *
 * 新しく Tauri API を使うときは、直接 import せずここに追加すること。
 */

export { isTauri };

/**
 * Web API のベース URL。
 *  - Tauri: env の VITE_WEB_BASE_URL(別オリジンでも plugin-http なので CORS 無関係)
 *  - ブラウザ: 空文字 = 同一オリジン相対(/api/...)。PWA は web と同じ
 *    ドメインの /app/ 配下で配信する前提(Cookie も Bearer も素直に通る)。
 */
export const WEB_BASE = isTauri()
  ? (import.meta.env.VITE_WEB_BASE_URL ?? "http://localhost:3000").replace(
      /\/$/,
      "",
    )
  : "";

/**
 * web ページの絶対 URL(外部ブラウザ/別タブで開く用)。ブラウザ実行時は
 * 同一オリジンなので相対のままでよいが、明示したい場合に使う。
 */
export function webUrl(path: string): string {
  return `${WEB_BASE}${path}`;
}

/** 環境に応じた fetch(Tauri は Rust 側 HTTP で CORS の影響を受けない)。 */
export const appFetch: typeof globalThis.fetch = (input, init) =>
  isTauri()
    ? (tauriFetch as unknown as typeof globalThis.fetch)(input, init)
    : globalThis.fetch(input, init);

/**
 * URL を開く。Tauri はシステムブラウザ、ブラウザは新しいタブ。
 * (PWA 内で決済や規約など web ページに遷移するときに使う)
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    await tauriOpenUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener");
}
