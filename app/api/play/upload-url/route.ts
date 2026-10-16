import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { createBearerClient } from "@/lib/supabase/bearer";
import { isSameOriginRequest } from "@/lib/api/origin";
import { RATE_LIMITS, checkRateLimit, tooManyRequestsResponse } from "@/lib/api/rate-limit";
import { isR2Configured, presignPut } from "@/lib/storage/r2";

/**
 * POST /api/play/upload-url — 卓の素材(画像・音声)のアップロード先を決める。
 *
 *   - R2 が設定済み: R2 へ直接 PUT する署名付き URL を返す(mode: "r2")。
 *     参加者のダウンロード転送量が無料になる(lib/storage/r2.ts)。
 *   - 未設定: { mode: "supabase" }(呼び出し側は従来どおり Supabase Storage に上げる)。
 *
 * Web はクッキー(同一オリジン検査あり)、デスクトップは Bearer で本人を判定する。
 * キーは `<user_id>/<sha256>.<ext>`(内容アドレス指定)。種類と大きさは署名に含める。
 */

export const dynamic = "force-dynamic";

const MAX_IMAGE = 20 * 1024 * 1024;
const MAX_AUDIO = 24 * 1024 * 1024;

function fail(status: number, message: string) {
  return NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const client = createBearerClient(auth.slice(7).trim());
    const {
      data: { user },
    } = await client.auth.getUser();
    return user?.id ?? null;
  }
  if (!isSameOriginRequest(request)) return null;
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function POST(request: NextRequest) {
  if (!isR2Configured()) {
    return NextResponse.json({ ok: true, mode: "supabase" }, { headers: { "Cache-Control": "no-store" } });
  }
  const userId = await resolveUserId(request);
  if (!userId) return fail(401, "ログインが必要です");
  if (!(await checkRateLimit(`media-upload:${userId}`, RATE_LIMITS.mediaUpload))) {
    return tooManyRequestsResponse();
  }

  let body: { hash?: unknown; ext?: unknown; mime?: unknown; size?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400, "不正なリクエストです");
  }
  const hash = typeof body.hash === "string" ? body.hash : "";
  const ext = typeof body.ext === "string" ? body.ext.toLowerCase() : "";
  const mime = typeof body.mime === "string" ? body.mime.toLowerCase() : "";
  const size = typeof body.size === "number" ? body.size : -1;
  if (!/^[0-9a-f]{64}$/.test(hash)) return fail(400, "ファイルの識別子が不正です");
  if (!/^[a-z0-9]{1,5}$/.test(ext)) return fail(400, "拡張子が不正です");
  const isImage = /^image\/[a-z0-9.+-]+$/.test(mime);
  const isAudio = /^audio\/[a-z0-9.+-]+$/.test(mime);
  if (!isImage && !isAudio) return fail(400, "画像か音声のファイルを選んでください");
  if (!Number.isInteger(size) || size <= 0) return fail(400, "ファイルの大きさが不正です");
  if (size > (isImage ? MAX_IMAGE : MAX_AUDIO)) {
    return fail(413, isImage ? "画像が大きすぎます(20MB まで)" : "音声が大きすぎます(24MB まで)");
  }

  const key = `${userId}/${hash}.${ext}`;
  const signed = presignPut({ key, contentType: mime, contentLength: size });
  if (!signed) return NextResponse.json({ ok: true, mode: "supabase" });
  return NextResponse.json(
    { ok: true, mode: "r2", uploadUrl: signed.uploadUrl, publicUrl: signed.publicUrl, path: key },
    { headers: { "Cache-Control": "no-store" } },
  );
}
