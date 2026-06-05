import Link from "next/link";
import type { Route } from "next";
import {
  LayoutDashboard,
  Package,
  Receipt,
  ThumbsUp,
  Plus,
  Pencil,
  AlertCircle,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CoverImage } from "@/components/store/cover-image";
import { CreatorNav } from "@/components/creator/creator-nav";
import { requireCreator } from "@/lib/session/require";
import { getCreatorDashboardStats } from "@/lib/queries/creator-dashboard";
import { getMyConnectStatus } from "@/lib/queries/creator-connect";
import { publicCoverUrl } from "@/lib/format/storage";
import { cn } from "@/lib/utils";

export const metadata = { title: "ダッシュボード" };

/**
 * クリエイターダッシュボード(BBBBBB)。自分の活動サマリを一覧する
 * トップ画面。統計タイル + ベストセラー作品 + Stripe 状態 + クイック
 * アクション。
 */
export default async function CreatorDashboardPage() {
  const user = await requireCreator();
  const [stats, connect] = await Promise.all([
    getCreatorDashboardStats(user.id),
    getMyConnectStatus(user.id),
  ]);

  const reviewLabelRatio =
    stats.reviews.positiveRatio !== null
      ? Math.round(stats.reviews.positiveRatio * 100)
      : null;

  return (
    <>
      <TopHeader />
      <SidebarLayout sidebar={<CreatorNav current="dashboard" />}>
        {/* Hero */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700">
            <LayoutDashboard className="h-5 w-5" aria-hidden />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold tracking-tight">
              ダッシュボード
            </h1>
            <p className="text-sm text-muted-foreground">
              {user.displayName || "クリエイター"} さんの活動サマリ
            </p>
          </div>
        </div>

        {/* Stripe 未接続のとき(ダッシュボードでも案内)*/}
        {!connect.stripeChargesEnabled && (
          <div className="mt-5 flex flex-col items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                aria-hidden
              />
              <p className="text-xs leading-relaxed text-amber-900">
                有料販売には Stripe 接続(受取口座の設定)が必要です。
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

        {/* 統計タイル */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            icon={Package}
            label="公開作品"
            value={`${stats.publishedCount}`}
            sub={`全 ${stats.productCount} 件(下書き ${stats.draftCount})`}
            tone="indigo"
          />
          <StatTile
            icon={Receipt}
            label="累計販売"
            value={`${stats.totalSales}`}
            sub="件(全作品合計)"
            tone="emerald"
          />
          <StatTile
            icon={ThumbsUp}
            label="レビュー"
            value={`${stats.reviews.total}`}
            sub={
              reviewLabelRatio !== null
                ? `好評率 ${reviewLabelRatio}%`
                : "まだありません"
            }
            tone="sky"
          />
          <StatTile
            icon={ThumbsUp}
            label="高評価 / 低評価"
            value={`${stats.reviews.positive} / ${stats.reviews.negative}`}
            sub="件"
            tone="amber"
          />
        </div>

        {/* ベストセラー作品 */}
        {stats.topProduct && stats.topProduct.salesCount > 0 && (
          <section className="mt-6 space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              ベストセラー作品
            </h2>
            <Link
              href={`/creator/products/${stats.topProduct.id}/edit` as Route}
              className="group flex items-center gap-4 rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:border-foreground/20 hover:shadow-card"
            >
              <div className="w-24 shrink-0 overflow-hidden rounded-md">
                <CoverImage
                  src={publicCoverUrl(stats.topProduct.coverPath)}
                  alt={stats.topProduct.title}
                  aspect="aspect-[16/10]"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold tracking-tight transition-colors group-hover:text-accent">
                  {stats.topProduct.title}
                </p>
                <Badge
                  variant="category"
                  className="mt-1 inline-flex items-center gap-1 text-[10px]"
                >
                  <Receipt className="h-3 w-3" aria-hidden />
                  累計販売 {stats.topProduct.salesCount} 件
                </Badge>
              </div>
              <Pencil
                className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground"
                aria-hidden
              />
            </Link>
          </section>
        )}

        {/* クイックアクション */}
        <section className="mt-6 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            クイックアクション
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href={"/creator/products/new" as Route}
              className={cn(buttonVariants({ variant: "primary" }))}
            >
              <Plus className="h-4 w-4" />
              新しい作品を登録
            </Link>
            <Link
              href={"/creator/products" as Route}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Package className="h-4 w-4" />
              作品を管理する
            </Link>
            {stats.publishedCount === 0 && (
              <span className="inline-flex items-center text-xs text-muted-foreground">
                まだ公開作品がありません。最初の作品を登録しましょう。
              </span>
            )}
          </div>
        </section>
      </SidebarLayout>
    </>
  );
}

/**
 * 統計タイル。アイコン + 大きい数値 + 補足。
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
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
