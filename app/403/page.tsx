import Link from "next/link";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "アクセス権限がありません | TRPG プラットフォーム" };

export default function ForbiddenPage() {
  return (
    <>
      <TopHeader />
      <PageContainer className="py-24">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
          <p className="text-sm font-medium text-muted-foreground">403</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            アクセス権限がありません
          </h1>
          <p className="text-sm text-muted-foreground">
            このページを表示するには適切な権限が必要です。
            クリエイター登録や管理者権限が必要な場合は、運営にお問い合わせください。
          </p>
          <Link href="/" className={cn(buttonVariants({ variant: "primary" }))}>
            トップへ戻る
          </Link>
        </div>
      </PageContainer>
    </>
  );
}
