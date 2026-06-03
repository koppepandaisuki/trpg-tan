import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { mimeToAvatarExt } from "@/lib/format/upload";
import { createAvatarUploadUrl } from "@/lib/storage/signed-upload-url";
import { isSameOriginRequest } from "@/lib/api/origin";

/**
 * POST /api/account/avatar-upload-url
 *
 * 自分のアバター画像用 signed upload URL を発行する。
 *
 * 認証必須(getCurrentUser)。Content-Type を検証して、許可された MIME
 * (png / jpeg / webp)からファイル拡張子を決定。Storage の path は
 * `<user_id>/<timestamp>.<ext>` でタイムスタンプ付きにすることで:
 *   - 旧画像はそのまま storage に残るが、profiles.avatar_path は新値を指す
 *   - 同タイムスタンプ衝突は実用上ほぼ無い
 *   - キャッシュバスティングは URL 自体が変わるので自動
 *
 * client は返ってきた path を別 server action (updateAvatarPathAction) で
 * profiles.avatar_path に書き込む(本ルートは Storage 側だけ気にする)。
 *
 * Body shape:  { "contentType": "image/png" }
 *
 * Response:
 *   200: { ok: true, url, path, expiresIn: 300 }
 *   400: invalid content type / missing field
 *   401: not authenticated
 *   403: cross-origin
 *   500: Storage signed URL generation failed
 */

const ADVERTISED_TTL = 300;

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, message: "リクエストが拒否されました" },
      { status: 403 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "ログインが必要です" },
      { status: 401 },
    );
  }

  let body: { contentType?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "リクエストが不正です" },
      { status: 400 },
    );
  }

  const contentType =
    typeof body.contentType === "string" ? body.contentType : "";
  if (!contentType) {
    return NextResponse.json(
      { ok: false, message: "Content-Type が指定されていません" },
      { status: 400 },
    );
  }

  const ext = mimeToAvatarExt(contentType);
  if (!ext) {
    return NextResponse.json(
      {
        ok: false,
        message: "対応していない画像形式です(PNG / JPEG / WebP のみ)",
      },
      { status: 400 },
    );
  }

  const path = `${user.id}/${Date.now()}.${ext}`;

  try {
    const url = await createAvatarUploadUrl(path);
    return NextResponse.json(
      { ok: true, url, path, expiresIn: ADVERTISED_TTL },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (err) {
    console.error("[avatar-upload-url] signed url failed", err);
    return NextResponse.json(
      { ok: false, message: "アップロードを開始できませんでした" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, message: "Method not allowed" },
    { status: 405 },
  );
}
