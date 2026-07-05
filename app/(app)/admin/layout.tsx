import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { requireAdmin } from "@/lib/session/require";
import {
  listVerifiedTotpFactors,
  getMfaAssuranceLevel,
} from "@/lib/mutations/mfa";

export const metadata = { title: "admin" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  // pathname is exposed by middleware (x-pathname). Default to /admin if missing.
  const pathname = headers().get("x-pathname") ?? "/admin";

  // 管理者は二段階認証(TOTP)が必須(Stripe セキュリティチェックリスト対応)。
  // /admin/mfa/* 自身はこのガードを素通しする(でないと自己ループする)。
  if (!pathname.startsWith("/admin/mfa")) {
    const factors = await listVerifiedTotpFactors();
    if (factors.length === 0) {
      redirect("/admin/mfa/enroll");
    }
    const aal = await getMfaAssuranceLevel();
    if (aal !== "aal2") {
      redirect("/admin/mfa/verify");
    }
  }

  return (
    <>
      <TopHeader />
      <PageContainer className="py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">管理画面</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              運営向けの最低限の操作画面です。すべての操作は監査ログに記録されます。
            </p>
          </div>
          <Badge variant="muted">admin</Badge>
        </div>

        <div className="mt-6">
          <AdminTabs pathname={pathname} />
        </div>

        <div className="mt-6">{children}</div>
      </PageContainer>
    </>
  );
}
