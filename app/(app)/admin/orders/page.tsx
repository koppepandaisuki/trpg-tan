import Link from "next/link";
import type { Route } from "next";
import { Receipt, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { OrderRow } from "@/components/admin/order-row";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { requireAdmin } from "@/lib/session/require";
import { listOrdersForAdmin } from "@/lib/queries/admin";
import { cn } from "@/lib/utils";

export const metadata = { title: "取引 | admin" };

interface PageProps {
  searchParams: { page?: string };
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  await requireAdmin();
  const page = Number.parseInt(searchParams.page ?? "1", 10) || 1;
  const { items, total, totalPages } = await listOrdersForAdmin({ page });

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { href: "/admin", label: "管理画面", icon: ShieldCheck },
          { label: "取引" },
        ]}
      />
      <AdminPageHeader
        title="取引"
        description="購入履歴の確認 / 返金。返金は各行の「Stripe で開く」から Stripe Dashboard で実行します(Phase 8 ではアプリ側で返金実行 UI を提供していません)。"
        icon={Receipt}
        tone="emerald"
        count={total}
      />

      {items.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            購入記録はまだありません。
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((o) => (
            <OrderRow key={o.id} order={o} />
          ))}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} />
    </div>
  );
}

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null;

  const buildHref = (p: number): Route => {
    if (p <= 1) return "/admin/orders";
    return `/admin/orders?page=${p}` as Route;
  };

  return (
    <nav className="flex items-center justify-center gap-3 pt-4 text-sm">
      <Link
        href={buildHref(Math.max(1, page - 1))}
        aria-disabled={page <= 1}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          page <= 1 && "pointer-events-none opacity-50",
        )}
      >
        前へ
      </Link>
      <span className="text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Link
        href={buildHref(Math.min(totalPages, page + 1))}
        aria-disabled={page >= totalPages}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          page >= totalPages && "pointer-events-none opacity-50",
        )}
      >
        次へ
      </Link>
    </nav>
  );
}
