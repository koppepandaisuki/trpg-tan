import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock, AlertCircle } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getCurrentUser } from "@/lib/session/get-user";

export const metadata = { title: "新しいパスワードを設定" };

/**
 * /reset-password
 *
 * パスワード再設定リンクから誘導される画面。リンクをクリックすると
 * /auth/callback で session 確立 → next=/reset-password でここに着く。
 *
 * session が無い(直接 URL でアクセスされた等)状態だと updateUser が
 * 失敗するため、本画面に未認証で来た場合は明示的に注意喚起する。
 * Supabase の Recovery session は通常のログインセッションと同一なので
 * getCurrentUser で取れる。
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  // 未ログインの場合: メールリンクが古い / session 切れ / 直接アクセス
  // などの可能性。エラー画面で /forgot-password への再リクエストを促す。
  if (!user) {
    return (
      <>
        <TopHeader />
        <PageContainer className="py-12">
          <Card className="mx-auto max-w-sm overflow-hidden border-border bg-gradient-to-br from-rose-500/10 via-transparent to-rose-500/5 shadow-sm">
            <CardContent className="relative space-y-5 py-8">
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-rose-500/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-rose-500/10 blur-3xl" />

              <div className="relative z-10 flex flex-col items-center gap-2 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-rose-300 bg-rose-50 text-rose-700">
                  <AlertCircle className="h-5 w-5" aria-hidden />
                </div>
                <h1 className="text-xl font-semibold tracking-tight">
                  リンクが無効です
                </h1>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  リセットリンクの有効期限が切れているか、無効な状態です。
                  お手数ですが、再度メール送信をリクエストしてください。
                </p>
              </div>
              <div className="relative z-10 space-y-2">
                <Link
                  href="/forgot-password"
                  className="block rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  再度メールを送信する
                </Link>
                <Link
                  href="/login"
                  className="block text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  ログイン画面に戻る
                </Link>
              </div>
            </CardContent>
          </Card>
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <TopHeader />
      <PageContainer className="py-12">
        <Card className="mx-auto max-w-sm overflow-hidden border-border bg-gradient-to-br from-violet-500/10 via-transparent to-sky-500/8 shadow-sm">
          <CardContent className="relative space-y-5 py-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-violet-500/12 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl" />

            <div className="relative z-10 flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-violet-300 bg-violet-50 text-violet-700">
                <Lock className="h-5 w-5" aria-hidden />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">
                新しいパスワード
              </h1>
              <p className="text-xs leading-relaxed text-muted-foreground">
                これから設定するパスワードで次回からログインできます。
              </p>
            </div>

            <div className="relative z-10">
              <ResetPasswordForm />
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
