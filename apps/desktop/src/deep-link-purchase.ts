import { onOpenUrl, getCurrent } from "@tauri-apps/plugin-deep-link";
import { listen } from "@tauri-apps/api/event";

/**
 * 購入の deep-link コールバック登録。
 *
 * Web の決済成功/キャンセルページが下記 URL に飛ばすので、それを受けて
 * ライブラリ更新やトースト表示を上位コンポーネントに伝える:
 *
 *   - paradice://purchase/complete?session_id=...
 *   - paradice://purchase/cancel?slug=...
 *
 * auth.ts と並列に `getCurrent / deep-link-url / onOpenUrl` の 3 経路を
 * 張る。auth 用 handler は prefix が違うので衝突しない。
 *
 * 同じ session_id を複数経路で受け取っても重複処理しないよう内部でガード。
 */

const processedSessions = new Set<string>();

export type PurchaseDeepLinkHandlers = {
  onComplete?: (info: { sessionId: string | null }) => void;
  onCancel?: (info: { slug: string | null }) => void;
  onSubscriptionComplete?: (info: { plan: string | null }) => void;
};

function handleUrl(raw: string, handlers: PurchaseDeepLinkHandlers): void {
  if (!raw.startsWith("paradice://purchase/") && !raw.startsWith("paradice://subscription/")) return;
  try {
    const u = new URL(raw);
    const scheme = raw.startsWith("paradice://subscription/") ? "subscription" : "purchase";
    const kind = u.pathname.replace(/^\/+/, "");
    if (scheme === "subscription" && kind === "complete") {
      const plan = u.searchParams.get("plan");
      const dedupKey = `sub:${plan}:${Date.now()}`;
      if (processedSessions.has(dedupKey)) return;
      processedSessions.add(dedupKey);
      handlers.onSubscriptionComplete?.({ plan });
    } else if (scheme === "purchase" && kind === "complete") {
      const sessionId = u.searchParams.get("session_id");
      const dedupKey = sessionId ?? `complete:${Date.now()}`;
      if (processedSessions.has(dedupKey)) return;
      processedSessions.add(dedupKey);
      handlers.onComplete?.({ sessionId });
    } else if (scheme === "purchase" && kind === "cancel") {
      handlers.onCancel?.({ slug: u.searchParams.get("slug") });
    }
  } catch (e) {
    console.error("[purchase-deeplink] failed to parse:", raw, e);
  }
}

export async function initDeepLinkPurchase(
  handlers: PurchaseDeepLinkHandlers,
): Promise<void> {
  try {
    const initial = await getCurrent();
    if (initial) for (const url of initial) handleUrl(url, handlers);
  } catch (e) {
    console.error("[purchase-deeplink] getCurrent failed:", e);
  }
  await listen<string>("deep-link-url", (event) => {
    handleUrl(event.payload, handlers);
  });
  await onOpenUrl((urls) => {
    for (const raw of urls) handleUrl(raw, handlers);
  });
}
