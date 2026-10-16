import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/api/origin";
import { RATE_LIMITS, checkRateLimit } from "@/lib/api/rate-limit";

/**
 * POST /api/auth/app-login-token — アプリ(デスクトップ / ブラウザ版 /app)へ渡す
 * 1 回限りのログイン用コードを発行する。
 *
 * 以前は Web のセッション(access / refresh トークン)をそのままアプリへ渡していたが、
 * 同じ refresh トークンを Web とアプリの両方が更新すると、Supabase の「refresh トークンの
 * 使い回し検知」でセッションごと無効になり、1 時間ほどで両方ともログアウトされていた
 * (「最初と卓を立てるときで二重にログインさせられた」の原因)。
 *
 * そこで、ログイン中の本人にだけ magic link のコード(token_hash)を発行し、アプリ側が
 * verifyOtp で「自分専用の別のセッション」を作る。メールは送らない(generateLink は
 * リンクを返すだけ)。コードは 1 回しか使えず、期限も短い。
 *
 * Cookie のセッションで本人を確認するので、同一オリジンの POST だけ受け付ける。
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, message: "不正なリクエストです" }, { status: 403, headers });
  }
  const user = await getCurrentUser();
  if (!user || !user.email) {
    return NextResponse.json({ ok: false, message: "ログインが必要です" }, { status: 401, headers });
  }
  if (!(await checkRateLimit(`app-login:${user.id}`, RATE_LIMITS.appLogin))) {
    return NextResponse.json(
      { ok: false, message: "しばらく時間をおいてからお試しください" },
      { status: 429, headers },
    );
  }
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    console.error("[app-login-token] generateLink failed", error?.message);
    return NextResponse.json({ ok: false, message: "発行に失敗しました" }, { status: 500, headers });
  }
  return NextResponse.json({ ok: true, tokenHash }, { headers });
}
