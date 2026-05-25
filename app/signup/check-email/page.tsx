import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "確認メールを送信しました | TRPG プラットフォーム" };

export default function CheckEmailPage() {
  return (
    <>
      <TopHeader />
      <PageContainer className="py-12">
        <Card className="mx-auto max-w-md shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">確認メールを送信しました</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              ご登録いただいたメールアドレスに、確認メールを送信しました。
              メール内のリンクをクリックして登録を完了してください。
            </p>
            <p>
              数分待ってもメールが届かない場合、迷惑メールフォルダをご確認ください。
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
