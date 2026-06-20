import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { createBearerClient } from "@/lib/supabase/bearer";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/api/origin";

/**
 * POST /api/account/delete — 自分のアカウントを削除(退会)。
 *
 * デスクトップアプリから「アプリ内で完結」して退会できるようにするための
 * エンドポイント。退会(auth.users 削除)は service_role が必須で、これは
 * サーバーにしか置けない。クライアントは「本人であること」を JWT で示し、
 * サーバーが admin 権限で *その本人だけ* を削除する。user_id は一切受け取らず、
 * 認証で確定したユーザーのみを対象にする(他人を消せない)。
 *
 * 認証(ダウンロード API と同じ二系統):
 *   A. Cookie(web): Origin(CSRF) + SSR セッション。
 *   B. Bearer(デスクトップ): `Authorization: Bearer <supabase access token>`。
 *      Bearer はアンビエント資格情報を伴わないので CSRF 対象外 → Origin 検査を省略。
 *
 * 制約(既存 deleteAccountAction と同一):
 *   - confirm に「退会する」が必要(誤操作防止)。
 *   - products.creator_id は profiles への on delete restrict のため、作品を
 *     1 つでも持つ creator は削除できない → 事前に件数を見て丁寧に拒否する。
 *
 * 成功時、クライアントはサインアウトする。
 */

const DELETE_CONFIRM_PHRASE = "退会する";

/** 呼び出し元(本人)の userId を確定する。Bearer 優先、無ければ Cookie。 */
async function resolveUserId(
  request: NextRequest,
): Promise<{ userId: string } | { error: NextResponse }> {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;

  // B. Bearer(デスクトップ)
  if (bearer) {
    const client = createBearerClient(bearer);
    const {
      data: { user },
      error,
    } = await client.auth.getUser(bearer);
    if (error || !user) {
      return {
        error: NextResponse.json(
          { ok: false, message: "ログインが必要です" },
          { status: 401 },
        ),
      };
    }
    return { userId: user.id };
  }

  // A. Cookie(web)。CSRF ベースライン → SSR セッション。
  if (!isSameOriginRequest(request)) {
    return {
      error: NextResponse.json(
        { ok: false, message: "リクエストが拒否されました" },
        { status: 403 },
      ),
    };
  }
  const user = await getCurrentUser();
  if (!user) {
    return {
      error: NextResponse.json(
        { ok: false, message: "ログインが必要です" },
        { status: 401 },
      ),
    };
  }
  return { userId: user.id };
}

export async function POST(request: NextRequest) {
  // 確認フレーズ(本文は壊れていても弾く)。
  let confirm = "";
  try {
    const body = (await request.json()) as { confirm?: unknown };
    confirm = typeof body.confirm === "string" ? body.confirm : "";
  } catch {
    confirm = "";
  }
  if (confirm.trim() !== DELETE_CONFIRM_PHRASE) {
    return NextResponse.json(
      {
        ok: false,
        message: `確認のため「${DELETE_CONFIRM_PHRASE}」と入力してください。`,
      },
      { status: 400 },
    );
  }

  // 本人を確定(他人は消せない)。
  const caller = await resolveUserId(request);
  if ("error" in caller) return caller.error;
  const { userId } = caller;

  const admin = createAdminClient();

  // 作品保有チェック(FK restrict で admin delete が失敗する前に丁寧に拒否)。
  const { count, error: countErr } = await admin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", userId);
  if (countErr) {
    console.error("[api/account/delete] product count failed", countErr);
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "作品を公開・登録中のため退会できません。先にすべての作品を削除するか、Discord にてご相談ください。",
      },
      { status: 409 },
    );
  }

  // admin(service_role)で auth.users を削除(profiles は cascade、
  // purchases.user_id は set null で購入記録は保全)。
  try {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("[api/account/delete] deleteUser failed", error);
      return NextResponse.json(
        {
          ok: false,
          message:
            "退会処理に失敗しました。時間をおいて再度お試しいただくか、Discord にてご相談ください。",
        },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error("[api/account/delete] deleteUser threw", err);
    return NextResponse.json(
      {
        ok: false,
        message:
          "退会処理に失敗しました。時間をおいて再度お試しいただくか、Discord にてご相談ください。",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

// 安全側: 想定外の GET を 405 にして破壊的操作を verb で守る。
export async function GET() {
  return NextResponse.json(
    { ok: false, message: "Method not allowed" },
    { status: 405 },
  );
}
