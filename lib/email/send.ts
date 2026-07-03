import "server-only";

/**
 * トランザクションメール送信(Resend)。
 *
 * Resend を fetch で直叩きする(SDK 依存を増やさない)。Discord webhook や
 * AI 審査と同じく**失敗に強い**設計: RESEND_API_KEY / EMAIL_FROM が未設定なら
 * 送信せず skipped を返し、通信失敗でも例外を投げない。メール送信は付随処理で
 * あり、本処理(審査の承認/却下)を止めてはいけない。
 *
 * 必要な env:
 *   RESEND_API_KEY  Resend の API キー(re_...)。未設定なら送信スキップ。
 *   EMAIL_FROM      差出人("Re-dice <noreply@yourdomain>")。未設定なら送信スキップ。
 */

const RESEND_API_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendEmailResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return { ok: true, skipped: true, reason: "メール送信は未設定です" };
  }
  if (!input.to) {
    return { ok: false, error: "宛先がありません" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[sendEmail] API error", res.status, detail.slice(0, 200));
      return { ok: false, error: `メール送信に失敗しました (${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "メール送信がタイムアウトしました" };
    }
    console.error("[sendEmail] unexpected", e);
    return { ok: false, error: "メール送信に失敗しました" };
  } finally {
    clearTimeout(timer);
  }
}
