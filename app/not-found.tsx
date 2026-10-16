import Link from "next/link";
import type { Route } from "next";
import { Compass } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 404 / not-found ページ。
 *
 * Next.js App Router の規約で、存在しないルートへのアクセスや
 * 各ページから `notFound()` を呼ばれたときに表示される。
 *
 * 見た目は他の状態画面と統一(success / cancel / 403 / empty state)
 * しつつ、slate トーンで「迷子になった / どこにもない」のニュアンス
 * を視覚化(403 = 拒否、404 = 見つからない、を区別)。
 */
export default function NotFound() {
  return (
    <>
      <TopHeader />
      <PageContainer className="py-16">
        <Card className="mx-auto max-w-md overflow-hidden border-border shadow-sm">
          <CardContent className="relative flex flex-col items-center gap-5 py-12 text-center">

            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-slate-700">
              <Compass className="h-8 w-8" aria-hidden />
            </div>

            <div className="relative z-10 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                404 Not Found
              </p>
              <h1 className="text-xl font-semibold tracking-tight">
                ページが見つかりませんでした
              </h1>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                URL が間違っているか、ページが移動・削除された可能性があります。
                URL やリンクの綴りをもう一度ご確認ください。
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
                href={"/play" as Route}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                PLAY を開く
              </Link>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
