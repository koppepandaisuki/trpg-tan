import "server-only";

/**
 * 運営向けアラートの共通送信口(Discord webhook)。
 * 異常検知の日次ダイジェスト(anomaly.ts)とチャージバック通知(stripe/webhook.ts)で共用。
 *
 * 送信先は DISCORD_ALERT_WEBHOOK_URL、無ければ DISCORD_FEEDBACK_WEBHOOK_URL に相乗り。
 * どちらも未設定なら送信スキップ(false)。送信失敗も false(呼び出し側の処理は止めない)。
 */

export function operatorAlertWebhookUrl(): string | null {
  return (
    process.env.DISCORD_ALERT_WEBHOOK_URL ??
    process.env.DISCORD_FEEDBACK_WEBHOOK_URL ??
    null
  );
}

/** Discord へ運営アラートを送る。送れたら true。 */
export async function postOperatorAlert(content: string): Promise<boolean> {
  const url = operatorAlertWebhookUrl();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Discord の 2000 字上限に対する保険。
      body: JSON.stringify({ content: content.slice(0, 1900) }),
    });
    return res.ok;
  } catch (e) {
    console.error("[operator-alert] post failed", e);
    return false;
  }
}
