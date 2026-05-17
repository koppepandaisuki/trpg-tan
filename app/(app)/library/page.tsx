import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function LibraryPage() {
  return (
    <>
      <TopHeader />
      <PageContainer className="py-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ライブラリ</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              購入済みの作品一覧(Phase 6 で実装、認証は Phase 3)
            </p>
          </div>
          <Badge variant="muted">P6</Badge>
        </div>

        <Card className="mt-6 shadow-sm">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            まだ作品がありません。
            <br />
            実装は Phase 6(認証 + Stripe決済の完了後)になります。
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
