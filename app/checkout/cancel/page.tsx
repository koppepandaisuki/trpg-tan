import Link from "next/link";
import type { Route } from "next";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { sanitizeSlug } from "@/lib/api/redirect";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "購入を完了していません | TRPG プラットフォーム",
};

interface PageProps {
  searchParams: { slug?: string };
}

export default function CheckoutCancelPage({ searchParams }: PageProps) {
  const slug = sanitizeSlug(searchParams.slug);
  const backHref: Route = slug ? (`/store/${slug}` as Route) : "/store";
  const backLabel = slug ? "作品ページへ戻る" : "ストアへ戻る";

  return (
    <>
      <TopHeader />
      <PageContainer className="py-16">
        <Card className="mx-auto max-w-md shadow-sm">
          <CardHeader>
            <CardTitle>購入を完了していません</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>もう一度お試しいただくか、別の作品をご覧ください。</p>
            <div className="flex flex-col gap-2 pt-2">
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

