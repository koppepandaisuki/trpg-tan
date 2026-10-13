import { NextResponse, type NextRequest } from "next/server";
import { vampireBloodJsonUrl } from "@trpg/core";
import { getCurrentUser } from "@/lib/session/get-user";
import { isSameOriginRequest } from "@/lib/api/origin";
import {
  RATE_LIMITS,
  checkRateLimit,
  tooManyRequestsResponse,
} from "@/lib/api/rate-limit";

/**
 * GET /api/sheets/vampire?input=<URL or ID> — キャラクター保管所のシート JSON を代理取得。
 *
 * 保管所は CORS を許可していないため、ブラウザ(Web 版キャラシ)から直接は取れない。
 * デスクトップは Tauri の HTTP で取得しているのと同じことをサーバーで行う。
 * 変換(sheetFromVampireBlood)はクライアント側で行い、ここは JSON を返すだけ。
 *
 * 外部取得の踏み台にされないように:
 *   - 取得先 URL は入力から「数字の ID だけ」を取り出して組み立て直す
 *     (@trpg/core の vampireBloodJsonUrl。charasheet.vampire-blood.net 以外は作れない)
 *   - リダイレクトは追わない / 8 秒で打ち切り / 2MB まで
 *   - ログイン必須 + ユーザー単位のレート制限
 */

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8000;

function fail(status: number, message: string) {
  return NextResponse.json(
    { ok: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  if (!isSameOriginRequest(request)) return fail(403, "不正なリクエストです");
  const user = await getCurrentUser();
  if (!user) return fail(401, "キャラクター保管所からの取り込みにはログインが必要です");
  if (!(await checkRateLimit(`sheet-import:${user.id}`, RATE_LIMITS.sheetImport))) {
    return tooManyRequestsResponse();
  }

  const input = request.nextUrl.searchParams.get("input") ?? "";
  const url = vampireBloodJsonUrl(input);
  if (!url) {
    return fail(
      400,
      "URL が正しくありません(例: https://charasheet.vampire-blood.net/12345)",
    );
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "error",
      signal: ctrl.signal,
      headers: { Accept: "application/json, text/javascript, */*" },
      cache: "no-store",
    });
    if (!res.ok) return fail(502, `保管所から取得できませんでした (${res.status})`);
    const len = Number(res.headers.get("content-length") ?? "0");
    if (len > MAX_BYTES) return fail(502, "シートが大きすぎます");
    const text = await res.text();
    if (text.length > MAX_BYTES) return fail(502, "シートが大きすぎます");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return fail(502, "保管所の応答を読めませんでした(非公開のシートかもしれません)");
    }
    if (!json || typeof json !== "object") return fail(502, "シートが見つかりませんでした");
    return NextResponse.json(
      { ok: true, sheet: json },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return fail(504, aborted ? "保管所の応答がありません(時間切れ)" : "保管所に接続できませんでした");
  } finally {
    clearTimeout(timer);
  }
}
