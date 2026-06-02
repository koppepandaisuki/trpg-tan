import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus, Sparkles } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { SignupForm } from "@/components/auth/signup-form";
import { getCurrentUser } from "@/lib/session/get-user";

export const metadata = { title: "新規登録 | TRPG プラットフォーム" };

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
        <Card className="mx-auto max-w-sm overflow-hidden border-border bg-gradient-to-br from-violet-500/10 via-transparent to-rose-500/8 shadow-sm">
          <CardContent className="relative space-y-5 py-8">
            {/* 装飾ブラー(控えめ) */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-violet-500/12 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-rose-500/10 blur-3xl" />

            <div className="relative z-10 flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-violet-300 bg-violet-50 text-violet-700">
                <UserPlus className="h-5 w-5" aria-hidden />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">新規登録</h1>
              <p className="text-xs text-muted-foreground">
                TRPG マーケットプレイスを始めましょう
              </p>
            </div>

            {/* α 期間中の歓迎メッセージ(Phase 2 で削除予定) */}
            <div className="relative z-10 flex items-start gap-2 rounded-md border border-violet-200 bg-violet-50/60 px-3 py-2 text-xs text-violet-900">
              <Sparkles
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-700"
                aria-hidden
              />
              <span>
                α テスター歓迎中。サインアップした方には自動で creator 権限が付与され、
                すぐに商品を出品できます。
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
