import Link from "next/link";
import type { Route } from "next";
import {
  Users,
  Package,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * admin index ページ。3 つの管理セクションへのナビゲーション集約。
 *
 * 見た目はサイト全体の視覚言語(グラデ + アイコン)に統一しつつ、
 * 各 admin 機能ごとに違うトーンを当てて識別性を高める:
 *   - ユーザー → slate(中立)
 *   - 作品 → indigo(商品関連)
 *   - 取引 → emerald(金銭関連、success と同系)
 */
export default function AdminTopPage() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
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
        description="作品の停止・公開復帰・下書き化"
        icon={Package}
        tone="indigo"
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
  indigo: "from-indigo-500/10 via-transparent to-violet-500/5",
  emerald: "from-emerald-500/10 via-transparent to-emerald-500/5",
};

const TONE_BADGES: Record<string, string> = {
  slate: "border-slate-300 bg-slate-50 text-slate-700",
  indigo: "border-indigo-300 bg-indigo-50 text-indigo-700",
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-700",
};

function NavCard({
  href,
  title,
  description,
  icon: Icon,
  tone,
}: {
  href: Route;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: keyof typeof TONE_GRADIENTS;
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
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
