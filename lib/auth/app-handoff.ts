import { createClient } from "@/lib/supabase/client";

/**
 * アプリ(デスクトップ / ブラウザ版 /app)へログインを渡すときの URL フラグメントを作る。
 *
 * まず 1 回限りのログイン用コード(token_hash)をサーバーに発行してもらい、アプリ側が
 * verifyOtp で「自分専用のセッション」を作れるようにする(Web とアプリで refresh トークンを
 * 共有すると、Supabase の使い回し検知で両方ログアウトされるため。
 * app/api/auth/app-login-token/route.ts)。
 *
 * 発行に失敗したとき(古い環境・一時障害)だけ、従来どおり今のセッションのトークンを渡す
 * (ログインできなくなるよりはよい)。ログインしていなければ null。
 */
export async function buildAppHandoffFragment(
  type: "desktop-handoff" | "app-handoff",
): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/app-login-token", {
      method: "POST",
      credentials: "same-origin",
    });
    const body = (await res.json()) as { ok?: boolean; tokenHash?: string };
    if (res.ok && body.ok && body.tokenHash) {
      return new URLSearchParams({ token_hash: body.tokenHash, type }).toString();
    }
    if (res.status === 401) return null;
  } catch {
    // 下の従来方式へ
  }
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.access_token || !session?.refresh_token) return null;
  return new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    type,
  }).toString();
}
