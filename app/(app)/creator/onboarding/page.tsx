import { TopHeader } from "@/components/layout/top-header";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { requireCreator } from "@/lib/session/require";
import {
  getMyConnectStatus,
  type ConnectStatus,
} from "@/lib/queries/creator-connect";
import { OnboardingStartButton } from "./start-button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Stripe 接続 | TRPG プラットフォーム" };

const CREATOR_NAV = [
  { label: "ダッシュボード", href: "/creator/products", current: false, disabled: true },
  { label: "作品管理", href: "/creator/products", current: false },
  { label: "Stripe 接続", href: "/creator/onboarding", current: true },
  { label: "売上・分析", href: "/creator/products", current: false, disabled: true },
  { label: "設定", href: "/creator/products", current: false, disabled: true },
];

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const user = await requireCreator();
  const status = await getMyConnectStatus(user.id);
  const returned = searchParams.status === "return";

  return (
    <>
      <TopHeader />
      <SidebarLayout
        sidebar={
          <nav className="space-y-1 rounded-lg border border-border bg-card p-2">
            <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              クリエイターメニュー
            </p>
            {CREATOR_NAV.map((item) => (
              <span
                key={item.label}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm",
                  item.current
                    ? "bg-foreground/5 font-medium text-foreground"
                    : "text-muted-foreground",
                  item.disabled && "opacity-60",
                )}
              >
                {item.label}
              </span>
            ))}
          </nav>
        }
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stripe 接続</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            作品を販売するには、Stripe で受取口座を接続する必要があります。
          </p>
        </div>

        <Card className="mt-6 shadow-sm">
          <CardContent className="space-y-4 py-6">
            <StateView status={status} returned={returned} />
          </CardContent>
        </Card>

        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            接続には Stripe での本人確認・口座情報入力が必要です。Stripe Express を経由するため、
            当プラットフォームに口座番号は保存されません。
          </span>
        </p>
      </SidebarLayout>
    </>
  );
}

function StateView({
  status,
  returned,
}: {
  status: ConnectStatus;
  returned: boolean;
}) {
  // Connected: charges_enabled が true ならフル接続済み
  if (status.stripeChargesEnabled) {
    return (
      <div className="flex items-start gap-3">
        <CheckCircle2
          className="mt-0.5 h-5 w-5 text-emerald-600"
          aria-hidden
        />
        <div>
          <p className="font-medium text-foreground">接続済</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Stripe との接続が完了しています。作品を公開して販売できます。
          </p>
          <Badge variant="muted" className="mt-2">
            charges_enabled = true
          </Badge>
        </div>
      </div>
    );
  }

  // In progress: account は作ったが onboarding が完了していない
  if (status.stripeAccountId) {
    return (
      <div className="flex items-start gap-3">
        <AlertCircle
          className="mt-0.5 h-5 w-5 text-amber-600"
          aria-hidden
        />
        <div>
          <p className="font-medium text-foreground">
            {returned ? "受信処理待ち" : "接続が中断されています"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {returned
              ? "Stripe から戻りました。完了状態がまだ反映されていない場合は数十秒お待ちいただき、ページを更新してください。"
              : "Stripe の入力が途中で止まっています。下のボタンから再開できます。"}
          </p>
          <div className="mt-3">
            <OnboardingStartButton label="Stripe で続行" />
          </div>
        </div>
      </div>
    );
  }

  // Not started
  return (
    <div className="space-y-3">
      <p className="font-medium text-foreground">まだ接続されていません</p>
      <p className="text-sm text-muted-foreground">
        Stripe Express の画面に遷移します。本人確認・口座情報を入力すると、自動でこの画面に戻ります。
      </p>
      <div className="pt-1">
        <OnboardingStartButton label="Stripe 接続を開始" />
      </div>
    </div>
  );
}
