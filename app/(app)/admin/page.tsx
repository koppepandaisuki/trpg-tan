import Link from "next/link";
import type { Route } from "next";
import {
  Users,
  Package,
  Receipt,
  Flag,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/session/require";
import {
  countPendingProducts,
  countOpenReports,
  countOpenReviewReports,
} from "@/lib/queries/admin";
import { cn } from "@/lib/utils";

/**
 * admin index ページ。管理セクションへのナビゲーション集約。
 *
 * 見た目はサイト全体の視覚言語(グラデ + アイコン)に統一しつつ、
 * 各 admin 機能ごとに違うトーンを当てて識別性を高める:
 *   - ユーザー → slate(中立)
 *   - 作品 → indigo(商品関連。審査待ち件数バッジ付き)
 *   - 通報 → rose(モデレーション。未対応件数バッジ付き)
 *   - 取引 → emerald(金銭関連、success と同系)
 */
export default async function AdminTopPage() {
  await requireAdmin();
  const [pendingCount, productReports, reviewReports] = await Promise.all([
    countPendingProducts(),
    countOpenReports(),
    countOpenReviewReports(),
  ]);
  const openReports = productReports + reviewReports;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <NavCard
        href="/admin/users"
        title="ユーザー"
        description="creator 権限の付与・剥奪を管理"
        icon={Users}
        tone="slate"
      />
      <NavCard
        href="/admin/products"
        title="作品"
        description="審査待ちの承認・却下、停止・公開復帰"
        icon={Package}
        tone="indigo"
        badge={pendingCount > 0 ? `審査待ち ${pendingCount}` : undefined}
      />
      <NavCard
        href={"/admin/reports" as Route}
        title="通報"
        description="利用者からの通報の確認・対応"
        icon={Flag}
        tone="rose"
        badge={openReports > 0 ? `未対応 ${openReports}` : undefined}
      />
      <NavCard
        href="/admin/orders"
        title="取引"
        description="購入履歴の確認 / Stripe Dashboard 連携での返金"
        icon={Receipt}
        tone="emerald"
      />
    </div>
  );
}

const TONE_GRADIENTS: Record<string, string> = {
  slate: "from-slate-500/10 via-transparent to-slate-500/5",
  indigo: "from-red-500/10 via-transparent to-violet-500/5",
  emerald: "from-emerald-500/10 via-transparent to-emerald-500/5",
  rose: "from-rose-500/10 via-transparent to-amber-500/5",
};

const TONE_BADGES: Record<string, string> = {
  slate: "border-slate-300 bg-slate-50 text-slate-700",
  indigo: "border-red-300 bg-red-50 text-red-700",
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-700",
  rose: "border-rose-300 bg-rose-50 text-rose-700",
};

function NavCard({
  href,
  title,
  description,
  icon: Icon,
  tone,
  badge,
}: {
  href: Route;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: keyof typeof TONE_GRADIENTS;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
    >
      <Card
        className={cn(
          "h-full overflow-hidden border-border bg-gradient-to-br shadow-sm transition group-hover:shadow-card",
          TONE_GRADIENTS[tone],
        )}
      >
        <CardContent className="space-y-3 py-5">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border",
                TONE_BADGES[tone],
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {badge && (
              <span className="ml-auto rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
