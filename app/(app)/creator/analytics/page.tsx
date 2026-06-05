import Link from "next/link";
import type { Route } from "next";
import {
  BarChart3,
  Wallet,
  Receipt,
  Landmark,
  ShoppingCart,
  AlertCircle,
  ArrowRight,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CoverImage } from "@/components/store/cover-image";
import { CreatorNav } from "@/components/creator/creator-nav";
import { EmptyState } from "@/components/store/empty-state";
import { requireCreator } from "@/lib/session/require";
import {
  getCreatorSalesBreakdown,
  type CreatorSalesProductRow,
  type CreatorMonthlySales,
} from "@/lib/queries/creator-analytics";
import { getMyConnectStatus } from "@/lib/queries/creator-connect";
import { formatPrice } from "@/lib/format/price";
import { publicCoverUrl } from "@/lib/format/storage";
import {
  statusLabel,
  statusBadgeVariant,
  type ProductStatus,
} from "@/lib/format/status";
import { PLATFORM_FEE_RATE } from "@/lib/stripe/fees";
import { cn } from "@/lib/utils";

export const metadata = { title: "売上・分析" };

/**
 * クリエイター「売上・分析」(JJJJJJ)。自作品の paid 購入を集計して
 * 全体サマリ + 月別推移 + 作品別明細を表示する。
 *
 * 金額は D-020 のスナップショット(application_fee_jpy)に基づく:
 *   総売上 - 手数料(30%) = 受取額(creator 取り分)
 */
export default async function CreatorAnalyticsPage() {
  const user = await requireCreator();
  const [breakdown, connect] = await Promise.all([
    getCreatorSalesBreakdown(user.id),
    getMyConnectStatus(user.id),
  ]);

  const { totals, products, monthly, productCount } = breakdown;
  const hasSales = totals.salesCount > 0;
  const feePercent = Math.round(PLATFORM_FEE_RATE * 100);

  return (
    <>
      <TopHeader />
      <SidebarLayout sidebar={<CreatorNav current="analytics" />}>
        {/* Hero */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700">
            <BarChart3 className="h-5 w-5" aria-hidden />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold tracking-tight">売上・分析</h1>
            <p className="text-sm text-muted-foreground">
              自分の作品の販売実績(プラットフォーム手数料 {feePercent}% を
              差し引いた受取額)
            </p>
          </div>
        </div>

        {/* Stripe 未接続のとき(受取に必要)*/}
        {!connect.stripeChargesEnabled && (
          <div className="mt-5 flex flex-col items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                aria-hidden
              />
              <p className="text-xs leading-relaxed text-amber-900">
                売上の受取には Stripe 接続(受取口座の設定)が必要です。未接続でも
                ¥0 の無料配布は可能ですが、有料販売の入金には接続を完了してください。
              </p>
            </div>
            <Link
              href={"/creator/onboarding" as Route}
              className={cn(
                buttonVariants({ variant: "primary", size: "sm" }),
                "shrink-0",
              )}
            >
              Stripe 接続を設定
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        )}

        {productCount === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={BarChart3}
              title="まだ作品がありません"
              description="作品を登録して販売すると、ここに売上の集計と作品別の明細が表示されます。"
              primaryAction={{
                href: "/creator/products/new",
                label: "新しい作品を登録",
              }}
            />
          </div>
        ) : (
          <>
            {/* サマリタイル */}
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                icon={ShoppingCart}
                label="販売件数"
                value={`${totals.salesCount}`}
                sub="件(全作品の paid 合計)"
                tone="indigo"
              />
              <StatTile
                icon={Receipt}
                label="総売上"
                value={formatPrice(totals.grossJpy)}
                sub="手数料差引前"
                tone="sky"
              />
              <StatTile
                icon={Landmark}
                label={`手数料 (${feePercent}%)`}
                value={formatPrice(totals.feeJpy)}
                sub="プラットフォーム取り分"
                tone="amber"
              />
              <StatTile
                icon={Wallet}
                label="受取額"
                value={formatPrice(totals.netJpy)}
                sub="あなたの取り分(目安)"
                tone="emerald"
              />
            </div>

            {/* 月別推移 */}
            {monthly.length > 0 && (
              <section className="mt-6 space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">
                  月別の売上(直近 {monthly.length} ヶ月)
                </h2>
                <Card className="shadow-sm">
                  <CardContent className="divide-y divide-border py-1">
                    {monthly.map((m) => (
                      <MonthlyRow
                        key={m.month}
                        data={m}
                        maxNet={Math.max(...monthly.map((x) => x.netJpy), 1)}
                      />
                    ))}
                  </CardContent>
                </Card>
              </section>
            )}

            {/* 作品別明細 */}
            <section className="mt-6 space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                作品別の明細
              </h2>
              {hasSales ? (
                <ul className="space-y-2">
                  {products.map((p) => (
                    <ProductSalesRow key={p.productId} row={p} />
                  ))}
                </ul>
              ) : (
                <Card className="shadow-sm">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    まだ販売実績がありません。作品が購入されると、ここに作品ごとの
                    売上が表示されます。
                  </CardContent>
                </Card>
              )}
            </section>
          </>
        )}
      </SidebarLayout>
    </>
  );
}

/**
 * サマリタイル(dashboard の StatTile と同じ視覚言語)。
 */
function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  tone: "indigo" | "emerald" | "sky" | "amber";
}) {
  const toneClass: Record<typeof tone, string> = {
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-1.5 py-4">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border",
            toneClass[tone],
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-xl font-bold tracking-tight">{value}</p>
        <p className="line-clamp-1 text-[10px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

/**
 * 月別 1 行。受取額を簡易バーで可視化(maxNet を 100% 幅とする)。
 */
function MonthlyRow({
  data,
  maxNet,
}: {
  data: CreatorMonthlySales;
  maxNet: number;
}) {
  const widthPct = Math.max(2, Math.round((data.netJpy / maxNet) * 100));
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="w-20 shrink-0 text-xs font-medium text-foreground">
        {formatMonth(data.month)}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-400"
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className="w-14 shrink-0 text-right text-[11px] text-muted-foreground">
        {data.salesCount} 件
      </span>
      <span className="w-24 shrink-0 text-right text-xs font-semibold tabular-nums">
        {formatPrice(data.netJpy)}
      </span>
    </div>
  );
}

/**
 * 作品別売上 1 行。カバー + タイトル + ステータス + 販売数 + 受取額。
 * クリックで編集ページへ。
 */
function ProductSalesRow({ row }: { row: CreatorSalesProductRow }) {
  const status = row.status as ProductStatus;
  return (
    <li>
      <Link
        href={`/creator/products/${row.productId}/edit` as Route}
        className="group flex items-center gap-4 rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:border-foreground/20 hover:shadow-card"
      >
        <div className="w-20 shrink-0 overflow-hidden rounded-md">
          <CoverImage
            src={publicCoverUrl(row.coverPath)}
            alt={row.title}
            aspect="aspect-[16/10]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold tracking-tight transition-colors group-hover:text-accent">
              {row.title}
            </p>
            <Badge
              variant={statusBadgeVariant(status)}
              className="shrink-0 text-[10px]"
            >
              {statusLabel(status)}
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {row.salesCount} 件販売
            {row.lastSoldAt && ` · 最終 ${formatDate(row.lastSoldAt)}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tabular-nums">
            {formatPrice(row.netJpy)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            総 {formatPrice(row.grossJpy)}
          </p>
        </div>
        <Pencil
          className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground"
          aria-hidden
        />
      </Link>
    </li>
  );
}

/** "YYYY-MM" → "YYYY年M月" */
function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  if (!y || !m) return month;
  return `${y}年${Number(m)}月`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
