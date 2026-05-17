import Link from "next/link";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <>
      <TopHeader />
      <PageContainer className="py-24">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
          <p className="text-sm font-medium text-muted-foreground">404</p>
          <h1 className="text-2xl font-semibold tracking-tight">ページが見つかりませんでした</h1>
          <p className="text-sm text-muted-foreground">
            URLが間違っているか、ページが削除された可能性があります。
          </p>
          <Link href="/" className={cn(buttonVariants({ variant: "primary" }))}>
            トップへ戻る
          </Link>
        </div>
      </PageContainer>
    </>
  );
}
