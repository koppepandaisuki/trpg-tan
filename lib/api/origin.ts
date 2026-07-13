import "server-only";
import type { NextRequest } from "next/server";

/**
 * Minimal CSRF mitigation for state-changing route handlers.
 *
 * Phase 6 ships only an Origin check. We don't add a CSRF token yet because:
 *   - signed-URL issuance is the single protected operation in this phase
 *   - Cookies are SameSite=Lax (Supabase default) so cross-origin POSTs from
 *     malicious sites won't carry the session anyway
 *   - The signed URL itself is short-lived (120s)
 *
 * Keep the helper small and reusable so Phase 9 can swap in a stronger
 * scheme (double-submit cookie or Edge-signed token) without rewriting
 * every call site.
 *
 * Returns true when the request is acceptable; false otherwise. Caller is
 * responsible for issuing 403.
 */
export function isSameOriginRequest(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  // Read-only methods do not modify state; allow without check.
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;

  const origin = request.headers.get("origin");
  // For state-changing methods, browsers send Origin reliably. Missing
  // Origin from a state-changing request is suspicious.
  if (!origin) return false;

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }
  const originHost = originUrl.host.toLowerCase();

  // 本命: リクエスト自身の Host(プロキシ経由なら X-Forwarded-Host)と比較。
  // 「ブラウザが今開いているホスト == Origin のホスト」なら同一オリジン。
  // Next.js が Server Actions で行う判定と同じ方式。
  //
  // 以前は単一の env(NEXT_PUBLIC_SITE_URL)とだけ比較していたが、本番が
  // 複数ドメイン(re-dice.net / paradaice.jp)+ www 付き + Vercel プレビュー
  // で運用されるため、env と違うドメインからの正当な POST がすべて 403 に
  // なっていた(2026-07 出品ファイルアップロード不能の原因)。
  //
  // クロスサイトの攻撃者はフォーム/simple request でカスタムヘッダを
  // 送れず(preflight で弾かれる)、Vercel は X-Forwarded-Host を
  // プラットフォーム側で上書きするため、Host 系ヘッダとの比較で
  // CSRF 判定として十分機能する。
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protoOk =
    !forwardedProto ||
    forwardedProto.split(",")[0].trim().toLowerCase() ===
      originUrl.protocol.replace(":", "").toLowerCase();
  if (protoOk) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const hostCandidates = [
      // X-Forwarded-Host はカンマ区切りで複数入ることがある(先頭が元ホスト)
      forwardedHost ? forwardedHost.split(",")[0] : null,
      request.headers.get("host"),
    ];
    for (const candidate of hostCandidates) {
      const host = candidate?.trim().toLowerCase();
      if (host && host === originHost) return true;
    }
  }

  // 補助: 明示設定されたサイト URL とも比較(リバースプロキシ等で Host が
  // 内部名に書き換わる構成向け)。こちらは従来どおりスキームまで含めた
  // 完全一致。env 未設定なら Host 比較のみで判定される。
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try {
      if (new URL(siteUrl).origin === originUrl.origin) return true;
    } catch {
      // 不正な env 値は無視(不一致扱い)
    }
  }
  return false;
}
