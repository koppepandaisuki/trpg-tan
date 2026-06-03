import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "アクセス権限がありません",
};

/**
 * 403 page.
 *
 * `requireCreator` / `requireAdmin` 等のロールガードが拒否したときに
 * redirect されてくるページ。
 *
 * 見た目は他の状態画面(success / cancel / empty state)と統一した
 * グラデ + 円形アイコンのカード型レイアウト。rose 系で「権限の問題」
 * を視覚的に表現(emergency でも error でもないトーン)。
 */
export default function ForbiddenPage() {
  return (
    <>
      <TopHeader />
      <PageContainer className="py-16">
        <Card className="mx-auto max-w-md overflow-hidden border-border bg-gradient-to-br from-rose-500/10 via-transparent to-rose-500/5 shadow-sm">
          <CardContent className="relative flex flex-col items-center gap-5 py-12 text-center">
            {/* 装飾ブラー */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-rose-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-rose-500/10 blur-3xl" />

            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-rose-300 bg-rose-50 text-rose-700">
              <ShieldAlert className="h-8 w-8" aria-hidden />
            </div>

            <div className="relative z-10 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                403 Forbidden
              </p>
              <h1 className="text-xl font-semibold tracking-tight">
                アクセス権限がありません
              </h1>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                このページを表示するには適切な権限が必要です。
                クリエイター登録や管理者権限が必要な場合は、運営にお問い合わせください。
              </p>
            </div>

            <div className="relative z-10 flex w-full flex-col gap-2 pt-2 sm:max-w-xs">
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "primary" }))}
              >
                トップへ戻る
              </Link>
              <Link
                href="/store"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                ストアを見る
              </Link>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
