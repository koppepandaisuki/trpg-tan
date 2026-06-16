import Link from "next/link";
import type { Route } from "next";
import { Flag, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { AdminReportRowCard } from "@/components/admin/report-row";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { requireAdmin } from "@/lib/session/require";
import { listReportsForAdmin } from "@/lib/queries/admin";
import type { ReportStatus } from "@/lib/validators/report";
import { cn } from "@/lib/utils";

export const metadata = { title: "通報 | admin" };

const STATUS_FILTERS: Array<{ value: "all" | ReportStatus; label: string }> = [
  { value: "open", label: "未対応" },
  { value: "all", label: "すべて" },
  { value: "reviewed", label: "対応済み" },
  { value: "dismissed", label: "却下" },
];

interface PageProps {
  searchParams: { status?: string; page?: string };
}

export default async function AdminReportsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const page = Number.parseInt(searchParams.page ?? "1", 10) || 1;
  // 既定は「未対応」だけを表示(対応すべきものに集中)。
  const status = parseStatus(searchParams.status) ?? "open";

  const { items, total, totalPages } = await listReportsForAdmin({
    page,
    status,
  });

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { href: "/admin", label: "管理画面", icon: ShieldCheck },
          { label: "通報" },
        ]}
      />
      <AdminPageHeader
        title="通報"
        description="利用者から寄せられた作品の通報。対応後は「対応済み」または「却下」にしてください。停止が必要な場合は作品ページから停止します。"
        icon={Flag}
        tone="rose"
        count={total}
      />

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = status === f.value;
          return (
            <Link
              key={f.value}
              href={buildHref(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                active
                  ? "bg-foreground/5 font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            該当する通報はありません。
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <AdminReportRowCard key={r.id} report={r} />
          ))}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} status={status} />
    </div>
  );
}

function parseStatus(value: string | undefined): ReportStatus | "all" | undefined {
  if (!value) return undefined;
  if (
    value === "all" ||
    value === "open" ||
    value === "reviewed" ||
    value === "dismissed"
  ) {
    return value;
  }
  return undefined;
}

function buildHref(value: "all" | ReportStatus): Route {
  const params = new URLSearchParams();
  params.set("status", value);
  return `/admin/reports?${params.toString()}` as Route;
}

function Pagination({
  page,
  totalPages,
  status,
}: {
  page: number;
  totalPages: number;
  status: ReportStatus | "all";
}) {
  if (totalPages <= 1) return null;

  const buildPageHref = (p: number): Route => {
    const params = new URLSearchParams();
    params.set("status", status);
    if (p > 1) params.set("page", String(p));
    return `/admin/reports?${params.toString()}` as Route;
  };

  return (
    <nav className="flex items-center justify-center gap-3 pt-4 text-sm">
      <Link
        href={buildPageHref(Math.max(1, page - 1))}
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
        href={buildPageHref(Math.min(totalPages, page + 1))}
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
