import Link from "next/link";
import { redirect } from "next/navigation";
import { LogIn, AlertCircle } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/session/get-user";
import { getLoginErrorMessage } from "@/lib/auth/login-errors";
import { safeNext } from "@/lib/api/redirect";

export const metadata = { title: "ログイン" };

interface LoginPageProps {
  searchParams: {
    error?: string;
    error_code?: string;
    next?: string;
  };
}

/**
 * ログインページ。
 *
 * 既ログインなら `/` にリダイレクト。
 * 見た目はサイト全体の視覚言語(グラデ + 円形アイコン)に統一しつつ、
 * 「フォーム入力が主役」なのでアイコンは控えめサイズ。indigo トーン
 * (HomeHero と同系)で「戻ってきた人を歓迎」のニュアンス。
 *
 * `searchParams.error` / `error_code` が付いていればフォーム上にエラー
 * バナーを表示。自前 `/auth/callback` 由来(missing_code / callback_failed)
 * と Supabase Auth 由来(otp_expired / access_denied 等)の両方を扱う。
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  // 既ログインなら ?next= があればそこへ(デスクトップ handoff 等)、無ければ /。
  // これにより「web に既ログイン → アプリのログインボタン」で即 handoff に
  // 飛び、ワンクリックでアプリにもセッションが入る。
  const user = await getCurrentUser();
  if (user) redirect(safeNext(searchParams.next));

  const errorMessage = getLoginErrorMessage(
    searchParams.error,
    searchParams.error_code,
  );

  return (
    <>
      <TopHeader />
      <PageContainer className="py-12">
        <Card className="mx-auto max-w-sm overflow-hidden border-border bg-gradient-to-br from-red-500/8 via-transparent to-amber-500/8 shadow-sm">
          <CardContent className="relative space-y-5 py-8">
            {/* 装飾ブラー(控えめ) */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-red-500/10 blur-3xl" />

            <div className="relative z-10 flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-700">
                <LogIn className="h-5 w-5" aria-hidden />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">ログイン</h1>
              <p className="text-xs text-muted-foreground">
                おかえりなさい。アカウント情報を入力してください。
              </p>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="relative z-10 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs text-rose-900"
              >
                <AlertCircle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-700"
                  aria-hidden
                />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="relative z-10">
              <LoginForm />
            </div>

            <div className="relative z-10 space-y-1 text-center text-xs text-muted-foreground">
              <p>
                <Link
                  href="/forgot-password"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  パスワードをお忘れですか?
                </Link>
              </p>
              <p>
                アカウントをお持ちでない方は{" "}
                <Link
                  href="/signup"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  新規登録
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
