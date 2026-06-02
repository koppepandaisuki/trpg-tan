import Link from "next/link";
import { redirect } from "next/navigation";
import { LogIn } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/session/get-user";

export const metadata = { title: "ログイン | TRPG プラットフォーム" };

/**
 * ログインページ。
 *
 * 既ログインなら `/` にリダイレクト。
 * 見た目はサイト全体の視覚言語(グラデ + 円形アイコン)に統一しつつ、
 * 「フォーム入力が主役」なのでアイコンは控えめサイズ。indigo トーン
 * (HomeHero と同系)で「戻ってきた人を歓迎」のニュアンス。
 */
export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <>
      <TopHeader />
      <PageContainer className="py-12">
        <Card className="mx-auto max-w-sm overflow-hidden border-border bg-gradient-to-br from-indigo-500/8 via-transparent to-violet-500/8 shadow-sm">
          <CardContent className="relative space-y-5 py-8">
            {/* 装飾ブラー(控えめ) */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-3xl" />

            <div className="relative z-10 flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-indigo-300 bg-indigo-50 text-indigo-700">
                <LogIn className="h-5 w-5" aria-hidden />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">ログイン</h1>
              <p className="text-xs text-muted-foreground">
                おかえりなさい。アカウント情報を入力してください。
              </p>
            </div>

            <div className="relative z-10">
              <LoginForm />
            </div>

            <p className="relative z-10 text-center text-xs text-muted-foreground">
              アカウントをお持ちでない方は{" "}
              <Link
                href="/signup"
                className="text-accent underline-offset-4 hover:underline"
              >
                新規登録
              </Link>
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
