import { redirect } from "next/navigation";
import { ShieldPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/session/require";
import { listVerifiedTotpFactors } from "@/lib/mutations/mfa";
import { MfaEnrollFlow } from "@/components/account/mfa-enroll-flow";
import { adminEnrollMfaAction, adminVerifyMfaAction } from "../actions";

export const metadata = { title: "二段階認証の設定 | admin" };

/**
 * 管理画面は二段階認証が必須(Stripe セキュリティチェックリスト対応)。
 * app/(app)/admin/layout.tsx が「検証済み factor が無い admin」をここへ
 * 誘導する。既に設定済みなら /admin/mfa/verify(再認証)へ回す。
 */
export default async function AdminMfaEnrollPage() {
  await requireAdmin();

  const factors = await listVerifiedTotpFactors();
  if (factors.length > 0) {
    redirect("/admin/mfa/verify");
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-4">
      <div className="space-y-1.5 text-center">
        <ShieldPlus className="mx-auto h-8 w-8 text-amber-600" aria-hidden />
        <h1 className="text-xl font-semibold">
          管理画面には二段階認証が必須です
        </h1>
        <p className="text-sm text-muted-foreground">
          Google Authenticator 等の認証アプリを使って設定してください。
        </p>
      </div>
      <Card className="shadow-sm">
        <CardContent className="py-6">
          <MfaEnrollFlow
            enrollAction={adminEnrollMfaAction}
            verifyAction={adminVerifyMfaAction}
            redirectTo="/admin"
          />
        </CardContent>
      </Card>
    </div>
  );
}
