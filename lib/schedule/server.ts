import "server-only";
import type { NextRequest } from "next/server";
import type { ZodError } from "zod";
import { getCurrentUser } from "@/lib/session/get-user";
import { createBearerClient } from "@/lib/supabase/bearer";
import { isSameOriginRequest } from "@/lib/api/origin";

/**
 * 日程調整 route handler 共通の小道具。
 *
 * セキュリティ方針:
 *   - 作成/投票/コメント/管理は、Bearer(デスクトップ) でなければ same-origin を要求
 *     (web からの正規ページ以外のクロスサイト POST スパムを弾く)。
 *   - ログインは「任意」。ログインしていれば user_id を裏で紐付けるだけで、
 *     未ログインでも操作はできる(信頼ベース)。
 */

/** Bearer があれば素通り、無ければ same-origin を要求。 */
export function isAllowedCaller(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) return true;
  return isSameOriginRequest(request);
}

/**
 * 任意ログインの呼び出し元 userId を解決(匿名なら null、例外にしない)。
 * Bearer(デスクトップ) 優先、無ければ Cookie(web)。
 */
export async function resolveOptionalUserId(
  request: NextRequest,
): Promise<string | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (bearer) {
    try {
      const client = createBearerClient(bearer);
      const {
        data: { user },
      } = await client.auth.getUser(bearer);
      return user?.id ?? null;
    } catch {
      return null;
    }
  }
  try {
    const user = await getCurrentUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/** zod エラーの先頭メッセージ(UI 表示用)。 */
export function zodFirstMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "入力が正しくありません";
}
