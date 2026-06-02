import Link from "next/link";
import type { Route } from "next";
import { RefreshCw } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { sanitizeSlug } from "@/lib/api/redirect";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "購入を完了していません | TRPG プラットフォーム",
};

interface PageProps {
  searchParams: { slug?: string };
}

/**
 * Checkout cancel page.
 *
 * Stripe Checkout で「戻る」or 決済キャンセル時に着地。
 * 見た目は HomeHero / EmptyState と統一しつつ、amber トーンで
 * 「失敗ではないが完了もしていない、引き返し可能な状態」を示す。
 */
export default function CheckoutCancelPage({ searchParams }: PageProps) {
  const slug = sanitizeSlug(searchParams.slug);
  const backHref: Route = slug ? (`/store/${slug}` as Route) : "/store";
  const backLabel = slug ? "作品ページへ戻る" : "ストアへ戻る";

  return (
    <>
      <TopHeader />
      <PageContainer className="py-16">
        <Card className="mx-auto max-w-md overflow-hidden border-border bg-gradient-to-br from-amber-500/10 via-transparent to-amber-500/5 shadow-sm">
          <CardContent className="relative flex flex-col items-center gap-5 py-12 text-center">
            {/* 装飾ブラー */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />

            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-700">
              <RefreshCw className="h-8 w-8" aria-hidden />
            </div>

            <div className="relative z-10 space-y-2">
              <h1 className="text-xl font-semibold tracking-tight">
                購入を完了していません
              </h1>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                決済はキャンセルされました。気が変わったらもう一度お試しいただくか、
                別の作品も見てみてください。
              </p>
            </div>

            <div className="relative z-10 flex w-full flex-col gap-2 pt-2 sm:max-w-xs">
              <Link
                href={backHref}
                className={cn(buttonVariants({ variant: "primary" }))}
              >
                {backLabel}
              </Link>
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                トップへ戻る
              </Link>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
