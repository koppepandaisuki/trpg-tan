import {
  ShoppingBag,
  LibraryBig,
  CheckCircle2,
  Clock,
  Ban,
  type LucideIcon,
} from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/store/empty-state";
import { LibraryCard } from "@/components/library/library-card";
import { requireUser } from "@/lib/session/require";
import { listMyLibrary, type LibraryItem } from "@/lib/queries/library";
import { formatPrice } from "@/lib/format/price";

export const metadata = { title: "ライブラリ | TRPG プラットフォーム" };

export default async function LibraryPage() {
  const user = await requireUser();
  const items = await listMyLibrary(user.id);

  const available = items.filter((i) => i.availability === "available");
  const pending = items.filter((i) => i.availability === "no_file");
  const suspended = items.filter(
    (i) => i.availability === "suspended" || i.availability === "blocked",
  );

  const totalSpent = items.reduce((sum, i) => sum + i.amountJpy, 0);

  return (
    <>
      <TopHeader />
      <PageContainer className="space-y-6 py-8">
        {/* Hero ヘッダー(サイト全体の視覚言語に統一)
            ライブラリは「所有 / 既購入」のトーンなので indigo + emerald
            の合成グラデで穏やかな positive 感を出す。 */}
        <Card className="overflow-hidden border-border bg-gradient-to-br from-indigo-500/8 via-transparent to-emerald-500/8 shadow-sm">
          <CardContent className="relative py-6 sm:py-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-indigo-300 bg-indigo-50 text-indigo-700">
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

              {items.length > 0 && (
                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                  <StatChip label="利用可能" value={available.length} />
                  {pending.length > 0 && (
                    <StatChip label="準備中" value={pending.length} />
                  )}
                  {suspended.length > 0 && (
                    <StatChip label="停止中" value={suspended.length} />
                  )}
                  <StatChip label="購入総額" value={formatPrice(totalSpent)} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="購入済みの作品はまだありません"
            description="ストアからお気に入りの作品を見つけて購入すると、ここに表示されます。テスト購入はテストカード 4242 4242 4242 4242 で行えます。"
            primaryAction={{ href: "/store", label: "ストアを見る" }}
            secondaryAction={{ href: "/", label: "ホームに戻る" }}
          />
        ) : (
          <div className="space-y-8">
            {available.length > 0 && (
              <Section
                title="利用可能"
                icon={CheckCircle2}
                tone="emerald"
                items={available}
              />
            )}
            {pending.length > 0 && (
              <Section
                title="準備中"
                icon={Clock}
                tone="amber"
                items={pending}
              />
            )}
            {suspended.length > 0 && (
              <Section
                title="配布停止中"
                icon={Ban}
                tone="slate"
                items={suspended}
              />
            )}
          </div>
        )}
      </PageContainer>
    </>
  );
}

function StatChip({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col items-end gap-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-base font-semibold tracking-tight">{value}</span>
    </div>
  );
}

const SECTION_TONES = {
  emerald: "text-emerald-700",
  amber: "text-amber-700",
  slate: "text-slate-600",
} as const;

function Section({
  title,
  icon: Icon,
  tone,
  items,
}: {
  title: string;
  icon: LucideIcon;
  tone: keyof typeof SECTION_TONES;
  items: LibraryItem[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${SECTION_TONES[tone]}`} aria-hidden />
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <Badge variant="muted" className="text-[10px]">
          {items.length}
        </Badge>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <LibraryCard key={item.purchaseId} item={item} />
        ))}
      </ul>
    </div>
  );
}
