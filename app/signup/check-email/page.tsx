import Link from "next/link";
import { MailCheck } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "確認メールを送信しました | TRPG プラットフォーム",
};

/**
 * Signup 完了直後の「メール確認待ち」ページ。
 *
 * サインアップ後にこのページに到達 → ユーザーがメール内のリンクを
 * クリック → `/auth/callback` → ログイン状態で `/` 等にリダイレクト、
 * という流れ。
 *
 * 見た目はサイト全体の視覚言語(グラデ + 円形アイコン)に統一。
 * sky トーン(他で未使用)で「メール / 通知」のメタファを表現。
 * 手順を 1/2/3 に分解して提示することで「次に何をすればよいか」が
 * 迷わず分かる。
 */
export default function CheckEmailPage() {
  return (
    <>
      <TopHeader />
      <PageContainer className="py-16">
        <Card className="mx-auto max-w-md overflow-hidden border-border bg-gradient-to-br from-sky-500/10 via-transparent to-sky-500/5 shadow-sm">
          <CardContent className="relative flex flex-col items-center gap-5 py-12 text-center">
            {/* 装飾ブラー */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sky-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />

            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-sky-300 bg-sky-50 text-sky-700">
              <MailCheck className="h-8 w-8" aria-hidden />
            </div>

            <div className="relative z-10 space-y-2">
              <h1 className="text-xl font-semibold tracking-tight">
                確認メールを送信しました
              </h1>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                ご登録いただいたメールアドレスに、確認メールを送信しました。
                メール内のリンクをクリックして登録を完了してください。
              </p>
            </div>

            <ul className="relative z-10 mx-auto max-w-sm space-y-2 text-left text-xs text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-semibold text-sky-700">1.</span>
                <span>メールアプリを開いて受信トレイを確認</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-sky-700">2.</span>
                <span>
                  件名「Confirm your signup」のメール内リンクをクリック
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-sky-700">3.</span>
                <span>自動でログイン状態になり、サイトに戻ります</span>
              </li>
            </ul>

            <div className="relative z-10 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
              数分待ってもメールが届かない場合は、
              <strong>迷惑メールフォルダ</strong>もご確認ください。
              それでも届かなければ Discord でご連絡ください。
            </div>

            <div className="relative z-10 flex w-full flex-col gap-2 pt-2 sm:max-w-xs">
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "primary" }))}
              >
                トップへ戻る
              </Link>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                ログイン画面へ
              </Link>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
