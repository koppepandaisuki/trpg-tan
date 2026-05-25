import Link from "next/link";
import { redirect } from "next/navigation";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/session/get-user";

export const metadata = { title: "ログイン | TRPG プラットフォーム" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <>
      <TopHeader />
      <PageContainer className="py-12">
        <Card className="mx-auto max-w-sm shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">ログイン</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <LoginForm />
            <p className="text-center text-xs text-muted-foreground">
              アカウントをお持ちでない方は{" "}
              <Link href="/signup" className="text-accent underline-offset-4 hover:underline">
                新規登録
              </Link>
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
