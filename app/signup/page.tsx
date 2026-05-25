import Link from "next/link";
import { redirect } from "next/navigation";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "@/components/auth/signup-form";
import { getCurrentUser } from "@/lib/session/get-user";

export const metadata = { title: "新規登録 | TRPG プラットフォーム" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <>
      <TopHeader />
      <PageContainer className="py-12">
        <Card className="mx-auto max-w-sm shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">新規登録</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SignupForm />
            <p className="text-center text-xs text-muted-foreground">
              すでにアカウントをお持ちの方は{" "}
              <Link href="/login" className="text-accent underline-offset-4 hover:underline">
                ログイン
              </Link>
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
