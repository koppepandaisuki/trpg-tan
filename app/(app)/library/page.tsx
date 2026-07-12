import {
  ShoppingBag,
  LibraryBig,
  CheckCircle2,
  Receipt,
  Package,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/store/empty-state";
import { LibraryBrowser } from "@/components/library/library-browser";
import { requireUser } from "@/lib/session/require";
import { listMyLibrary } from "@/lib/queries/library";
import { formatPrice } from "@/lib/format/price";
import { cn } from "@/lib/utils";

export const metadata = { title: "ライブラリ" };

export default async function LibraryPage() {
  const user = await requireUser();
  const items = await listMyLibrary(user.id);

  const available = items.filter((i) => i.availability === "available");
  const pending = items.filter((i) => i.availability === "no_file");

  const totalSpent = items.reduce((sum, i) => sum + i.amountJpy, 0);
  // 直近の購入日(paidAt の最大値)。1 件もないときは null。
  const latestPaidAt =
    items.length > 0
      ? items.reduce(
          (latest, i) => (i.paidAt > latest ? i.paidAt : latest),
          items[0].paidAt,
        )
      : null;

  return (
    <>
      <TopHeader />
      <PageContainer className="space-y-6 py-8">
        {/* Hero ヘッダー(シンプル化。サマリは下の統計タイルに集約)*/}
        <Card className="overflow-hidden border-border bg-gradient-to-br from-red-500/8 via-transparent to-emerald-500/8 shadow-sm">
          <CardContent className="relative py-6 sm:py-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

            <div className="relative z-10 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-700">
                <LibraryBig className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  ライブラリ
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {items.length > 0
                    ? `購入した作品 ${items.length} 件`
                    : "購入した作品はまだありません"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 購入サマリ統計タイル(EEEEEE)。dashboard と同じ視覚言語。*/}
        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryTile
              icon={Package}
              label="購入作品"
              value={`${items.length}`}
              sub={`利用可能 ${available.length} 件`}
              tone="indigo"
            />
            <SummaryTile
              icon={Receipt}
              label="購入総額"
              value={formatPrice(totalSpent)}
              sub={
                items.length > 0
                  ? `平均 ${formatPrice(Math.round(totalSpent / items.length))} / 件`
                  : ""
              }
              tone="emerald"
            />
            <SummaryTile
              icon={CheckCircle2}
              label="利用可能"
              value={`${available.length}`}
              sub={
                pending.length > 0
                  ? `準備中 ${pending.length} 件`
                  : "すべてダウンロード可"
              }
              tone="sky"
            />
            <SummaryTile
              icon={CalendarDays}
              label="最近の購入"
              value={latestPaidAt ? formatDate(latestPaidAt) : "—"}
              sub="直近の購入日"
              tone="amber"
            />
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="購入済みの作品はまだありません"
            description="ストアからお気に入りの作品を見つけて購入すると、ここに表示されます。テスト購入はテストカード 4242 4242 4242 4242 で行えます。"
            primaryAction={{ href: "/store", label: "ストアを見る" }}
            secondaryAction={{ href: "/", label: "ホームに戻る" }}
          />
        ) : (
          <LibraryBrowser items={items} />
        )}
      </PageContainer>
    </>
  );
}

/**
 * 購入サマリの統計タイル(EEEEEE)。creator dashboard の StatTile と
 * 同じ視覚言語(円形アイコン + 大きい数値 + 補足)。
 */
function SummaryTile({
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
    indigo: "border-red-200 bg-red-50 text-red-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    sky: "border-red-200 bg-red-50 text-red-700",
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
