import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus, Sparkles } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { SignupForm } from "@/components/auth/signup-form";
import { getCurrentUser } from "@/lib/session/get-user";

export const metadata = { title: "新規登録" };

/**
 * 新規登録ページ。
 *
 * 既ログインなら `/` にリダイレクト。
 * 見た目はサイト全体の視覚言語(グラデ + 円形アイコン)に統一。
 * violet トーンで「新規参加」のニュアンス、α テスター歓迎の補足を
 * 小さく添える(α 期間限定の案内、後段で消す)。
 */
export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <>
      <TopHeader />
      <PageContainer className="py-12">
        <Card className="mx-auto max-w-sm overflow-hidden border-border shadow-sm">
          <CardContent className="relative space-y-5 py-8">

            <div className="relative z-10 flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white">
                <UserPlus className="h-5 w-5" aria-hidden />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">新規登録</h1>
              <p className="text-xs text-muted-foreground">
                卓を立てて、すぐ遊びましょう
              </p>
            </div>

            {/* α 期間中の歓迎メッセージ(Phase 2 で削除予定) */}
            <div className="relative z-10 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-foreground/80">
              <Sparkles
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                aria-hidden
              />
              <span>
                α テスター歓迎中。登録するとすぐに卓を立てられます。
              </span>
            </div>

            <div className="relative z-10">
              <SignupForm />
            </div>

            <p className="relative z-10 text-center text-xs text-muted-foreground">
              すでにアカウントをお持ちの方は{" "}
              <Link
                href="/login"
                className="text-accent underline-offset-4 hover:underline"
              >
                ログイン
              </Link>
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
