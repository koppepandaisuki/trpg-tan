import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getCurrentUser } from "@/lib/session/get-user";

export const metadata = { title: "パスワードをお忘れですか?" };

/**
 * /forgot-password
 *
 * パスワードリセットメールの送信フォーム。
 *
 * 既ログイン状態なら設定ページに redirect(セッションがあるならパスワード
 * 変更は /account/settings からやればよい、ここに来る必要がない)。
 *
 * 視覚言語は他の auth ページ(login/signup)と同じ Card + Hero アイコン。
 * indigo/violet トーンで「アカウント関連」をニュアンス。
 */
export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect("/account/settings");

  return (
    <>
      <TopHeader />
      <PageContainer className="py-12">
        <Card className="mx-auto max-w-sm overflow-hidden border-border bg-gradient-to-br from-red-500/8 via-transparent to-amber-500/8 shadow-sm">
          <CardContent className="relative space-y-5 py-8">
            {/* 装飾ブラー */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-red-500/10 blur-3xl" />

            <div className="relative z-10 flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-700">
                <KeyRound className="h-5 w-5" aria-hidden />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">
                パスワードをお忘れですか?
              </h1>
              <p className="text-xs leading-relaxed text-muted-foreground">
                登録メールアドレスを入力してください。
                <br />
                パスワード再設定用のリンクをお送りします。
              </p>
            </div>

            <div className="relative z-10">
              <ForgotPasswordForm />
            </div>

            <p className="relative z-10 text-center text-xs text-muted-foreground">
              <Link
                href="/login"
                className="text-accent underline-offset-4 hover:underline"
              >
                ログイン画面に戻る
              </Link>
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
