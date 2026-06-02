import { TopHeader } from "@/components/layout/top-header";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertCircle,
  Info,
  HelpCircle,
  Camera,
  type LucideIcon,
} from "lucide-react";
import { requireCreator } from "@/lib/session/require";
import {
  getMyConnectStatus,
  type ConnectStatus,
} from "@/lib/queries/creator-connect";
import { isAlphaAllowFreeWithoutConnectEnabled } from "@/lib/access/alpha-publish-policy";
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
  const alphaFreeAllowed = isAlphaAllowFreeWithoutConnectEnabled();

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
            作品を有償販売するには、Stripe で受取口座を接続する必要があります。
          </p>
        </div>

        <Card className="mt-6 shadow-sm">
          <CardContent className="space-y-4 py-6">
            <StateView status={status} returned={returned} />
          </CardContent>
        </Card>

        {/* 状態が「接続済」のとき以外は、なぜ必要か / 何ができるかの
            詳しい説明を出す。テスター UX 改善 */}
        {!status.stripeChargesEnabled && (
          <ExplainerCard alphaFreeAllowed={alphaFreeAllowed} />
        )}
      </SidebarLayout>
    </>
  );
}

function ExplainerCard({ alphaFreeAllowed }: { alphaFreeAllowed: boolean }) {
  return (
    <Card className="mt-4 shadow-sm">
      <CardContent className="space-y-5 py-6 text-sm">
        <Section title="Stripe 接続でできること" icon={CheckCircle2} tone="positive">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>作品を有償販売できます</strong>
              (¥100 以上の価格を設定可)
            </li>
            <li>
              売上の <strong>70%</strong> が直接あなたの銀行口座に入金されます
              (残り 30% はプラットフォーム手数料)
            </li>
            <li>返金処理は Stripe が自動で対応(手作業不要)</li>
          </ul>
        </Section>

        {alphaFreeAllowed && (
          <Section
            title="接続せずにできること(α 期間中の特例)"
            icon={Info}
            tone="info"
          >
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>無料商品(¥0)の公開</strong>
                は Stripe 接続なしでも可能
              </li>
              <li>
                テスト用にコンテンツを公開・他のテスターに DL してもらう、までは
                接続なしで進められます
              </li>
              <li>
                有償販売したくなったタイミングで Stripe 接続を完了させて OK
              </li>
            </ul>
          </Section>
        )}

        <Section title="接続に必要なもの" icon={Info} tone="neutral">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>本人確認書類</strong>(運転免許証 / マイナンバーカード /
              パスポートのいずれか 1 種類)
            </li>
            <li>銀行口座情報(振込先)</li>
            <li>住所・電話番号</li>
            <li>所要時間:約 5〜10 分</li>
          </ul>
        </Section>

        <Section title="本人確認の写真が通らないとき" icon={Camera} tone="warning">
          <ul className="list-disc space-y-1 pl-5">
            <li>明るい場所(自然光が理想)で影が映らないように撮影</li>
            <li>iPhone なら「ファイル」アプリのスキャン機能を使うと精度が上がります</li>
            <li>
              1 種類目で失敗したら別の身分証を試す(免許 → マイナンバー → パスポートの順)
            </li>
            <li>カードの全体(角まで)が画面内に収まるように</li>
            {alphaFreeAllowed && (
              <li>
                どうしても通らない場合は、α 期間中は接続なしで{" "}
                <strong>無料商品(¥0)の公開のみで参加</strong>
                していただいて構いません
              </li>
            )}
          </ul>
        </Section>

        <p className="flex items-start gap-2 text-xs text-muted-foreground border-t border-border pt-4">
          <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Stripe Express を経由するため、当プラットフォームに口座番号・本人確認情報は
            保存されません。すべて Stripe(米国上場の決済プラットフォーム)で管理されます。
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  icon: LucideIcon;
  tone: "positive" | "info" | "neutral" | "warning";
  children: React.ReactNode;
}) {
  const toneClass = {
    positive: "text-emerald-700",
    info: "text-blue-700",
    neutral: "text-foreground",
    warning: "text-amber-700",
  }[tone];

  return (
    <div>
      <h3 className={cn("flex items-center gap-2 font-medium", toneClass)}>
        <Icon className="h-4 w-4" aria-hidden />
        {title}
      </h3>
      <div className="mt-2 text-muted-foreground">{children}</div>
    </div>
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
