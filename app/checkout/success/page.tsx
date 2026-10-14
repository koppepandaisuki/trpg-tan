import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2, Coins } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ReturnToDesktop } from "@/components/checkout/return-to-desktop";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "お手続きを受け付けました",
};

interface PageProps {
  searchParams: {
    return_to?: string;
    sub?: string;
    gold?: string;
  };
}

/**
 * Stripe Checkout の完了ページ(プラン加入 `?sub=` / ゴールド購入 `?gold=`)。
 *
 * 2026-09 のストア廃止で作品購入の分岐は無くなった。反映の正は webhook で、
 * このページは DB を確認しない(数秒遅れて反映されることがある)。
 */
export default function CheckoutSuccessPage({ searchParams }: PageProps) {
  const isDesktopReturn = searchParams.return_to === "desktop";
  const subPlan =
    searchParams.sub === "pro"
      ? "pro"
      : searchParams.sub === "play"
        ? "play"
        : null;
  const goldAmount = (() => {
    const n = Number(searchParams.gold);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  })();

  return (
    <>
      <TopHeader />
      <PageContainer className="py-16">
        <Card className="mx-auto max-w-md overflow-hidden border-border shadow-sm">
          <CardContent className="relative flex flex-col items-center gap-5 py-12 text-center">

            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-emerald-700">
              {goldAmount ? (
                <Coins className="h-8 w-8" aria-hidden />
              ) : (
                <CheckCircle2 className="h-8 w-8" aria-hidden />
              )}
            </div>

            <div className="relative z-10 space-y-2">
              <h1 className="text-xl font-semibold tracking-tight">
                {goldAmount
                  ? "ゴールドを購入しました"
                  : subPlan
                    ? "プランが有効になりました"
                    : "お手続きを受け付けました"}
              </h1>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                {goldAmount
                  ? `${goldAmount.toLocaleString()} ゴールドを追加しました。まもなく残高に反映されます。AI 機能に使えます。`
                  : subPlan
                    ? `${subPlan === "pro" ? "Pro" : "プレイ"}プランへようこそ！まもなくアカウントに反映されます。`
                    : "決済結果を確認しています。通常は数秒で反映されます。"}
              </p>
            </div>

            {isDesktopReturn ? (
              <ReturnToDesktop
                kind="complete"
                subPlan={subPlan ?? undefined}
                goldAmount={goldAmount ?? undefined}
              />
            ) : (
              <div className="relative z-10 flex w-full flex-col gap-2 pt-2 sm:max-w-xs">
                <Link
                  href={"/play" as Route}
                  className={cn(buttonVariants({ variant: "primary" }))}
                >
                  PLAY を開く
                </Link>
                <Link
                  href="/pricing"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  プラン画面へ
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
