import { onOpenUrl, getCurrent } from "@tauri-apps/plugin-deep-link";
import { listen } from "@tauri-apps/api/event";

/**
 * 決済完了の deep-link コールバック登録。
 *
 * Web の決済完了ページが下記 URL に飛ばすので、それを受けてプラン/ゴールドの
 * 再取得やトースト表示を上位コンポーネントに伝える:
 *
 *   - redice://subscription/complete?plan=...
 *   - redice://gold/complete?amount=...
 *   (旧ブランドの paradice:// も受理する)
 *
 * 作品購入の redice://purchase/* は 2026-09 のストア廃止で撤去した
 * (古い Web ページから飛んできても無視する)。
 *
 * auth.ts と並列に `getCurrent / deep-link-url / onOpenUrl` の 3 経路を
 * 張る。auth 用 handler は prefix が違うので衝突しない。
 *
 * 同じ URL を複数経路で受け取っても重複処理しないよう内部でガード。
 */

const processedSessions = new Set<string>();

/** redice:// と旧 paradice:// を同一視して "<スキーム>://" 以降を返す。 */
function stripScheme(raw: string): string | null {
  if (raw.startsWith("redice://")) return raw.slice("redice://".length);
  if (raw.startsWith("paradice://")) return raw.slice("paradice://".length);
  return null;
}

export type PurchaseDeepLinkHandlers = {
  onSubscriptionComplete?: (info: { plan: string | null }) => void;
  onGoldComplete?: (info: { amount: number | null }) => void;
};

function handleUrl(raw: string, handlers: PurchaseDeepLinkHandlers): void {
  const rest = stripScheme(raw);
  if (!rest || (!rest.startsWith("subscription/") && !rest.startsWith("gold/")))
    return;
  try {
    const u = new URL(raw);
    const scheme = rest.startsWith("subscription/") ? "subscription" : "gold";
    const kind = u.pathname.replace(/^\/+/, "");
    if (scheme === "gold" && kind === "complete") {
      const amt = Number(u.searchParams.get("amount"));
      const dedupKey = `gold:${amt}:${Date.now()}`;
      if (processedSessions.has(dedupKey)) return;
      processedSessions.add(dedupKey);
      handlers.onGoldComplete?.({ amount: Number.isFinite(amt) ? amt : null });
    } else if (scheme === "subscription" && kind === "complete") {
      const plan = u.searchParams.get("plan");
      const dedupKey = `sub:${plan}:${Date.now()}`;
      if (processedSessions.has(dedupKey)) return;
      processedSessions.add(dedupKey);
      handlers.onSubscriptionComplete?.({ plan });
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
