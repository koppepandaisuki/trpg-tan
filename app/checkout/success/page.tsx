import Link from "next/link";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "ご購入手続きを受け付けました | TRPG プラットフォーム",
};

interface PageProps {
  searchParams: { session_id?: string };
}

/**
 * Checkout success page.
 *
 * The session_id query is accepted for tracing only. The page does NOT
 * use it to confirm anything against the DB — webhook is the single source
 * of truth, and reflection into the library may lag by a few seconds.
 */
export default function CheckoutSuccessPage({ searchParams }: PageProps) {
  if (process.env.NODE_ENV !== "production" && searchParams.session_id) {
    // Development-only trace. Not surfaced to the user.
    console.info("[checkout/success] session_id", searchParams.session_id);
  }

  return (
    <>
      <TopHeader />
      <PageContainer className="py-16">
        <Card className="mx-auto max-w-md shadow-sm">
          <CardHeader>
            <CardTitle>ご購入手続きを受け付けました</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              決済結果を確認しています。購入内容はまもなくライブラリに反映されます。
            </p>
            <p>反映までに少し時間がかかる場合があります(通常は数秒)。</p>
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/library"
                className={cn(buttonVariants({ variant: "primary" }))}
              >
                ライブラリを開く
              </Link>
              <Link
                href="/store"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                ストアへ戻る
              </Link>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
