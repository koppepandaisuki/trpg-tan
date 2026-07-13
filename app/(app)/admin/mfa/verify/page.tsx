import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/session/require";
import { listVerifiedTotpFactors } from "@/lib/mutations/mfa";
import { MfaChallengeForm } from "@/components/account/mfa-challenge-form";
import { adminVerifyMfaAction } from "../actions";

export const metadata = { title: "二段階認証 | admin" };

/**
 * 既に TOTP を設定済みの管理者が、aal1 のセッション(ログイン直後等)で
 * 管理画面に来たときの再認証(step-up)ページ。
 * factor が無ければ /admin/mfa/enroll(新規設定)へ回す。
 */
export default async function AdminMfaVerifyPage() {
  await requireAdmin();

  const factors = await listVerifiedTotpFactors();
  if (factors.length === 0) {
    redirect("/admin/mfa/enroll");
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-4">
      <div className="space-y-1.5 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-amber-600" aria-hidden />
        <h1 className="text-xl font-semibold">認証コードを入力してください</h1>
        <p className="text-sm text-muted-foreground">
          認証アプリに表示されている 6 桁のコードで本人確認します。
        </p>
      </div>
      <Card className="shadow-sm">
        <CardContent className="py-6">
          <MfaChallengeForm
            factorId={factors[0].id}
            verifyAction={adminVerifyMfaAction}
            redirectTo="/admin"
          />
        </CardContent>
      </Card>
    </div>
  );
}
