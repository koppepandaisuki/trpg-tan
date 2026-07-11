import { appFetch as fetch, WEB_BASE } from "./platform";
import { supabase } from "./supabase";

/**
 * Web の「フィードバック」(カテゴリ選択+本文 → /api/feedback)を
 * デスクトップからも送れるようにするラッパー。
 * HTTP は webview の fetch ではなく tauri-plugin-http(Rust 側)を使う
 * (download.ts / account-remote.ts と同じ方針、CORS の影響を受けない)。
 */

// WEB_BASE は platform.ts(Tauri=env / ブラウザ=同一オリジン相対)

export type FeedbackCategory = "bug" | "feature_request" | "question" | "other";

/**
 * フィードバックを送信する。本人の JWT を Bearer で送り、サーバーが
 * user_id / email / display_name をサーバー側で解決して Discord へ転送する。
 * 失敗はサーバーのメッセージ(レート制限・入力不正 等)を Error として投げる。
 */
export async function sendFeedback(
  category: FeedbackCategory,
  body: string,
): Promise<{ delivered: boolean }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("ログインが必要です。再度ログインしてください。");

  const res = await fetch(`${WEB_BASE}/api/feedback`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ category, body }),
  });

  let resBody: { ok?: boolean; message?: string; delivered?: boolean };
  try {
    resBody = (await res.json()) as typeof resBody;
  } catch {
    throw new Error(`サーバ応答が不正です (${res.status})`);
  }

  if (!res.ok || !resBody.ok) {
    throw new Error(resBody.message ?? `送信に失敗しました (${res.status})`);
  }
  return { delivered: Boolean(resBody.delivered) };
}
