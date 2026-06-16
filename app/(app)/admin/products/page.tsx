import Link from "next/link";
import type { Route } from "next";
import { Package, ShieldCheck, ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { AdminProductRowCard } from "@/components/admin/product-row";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { requireAdmin } from "@/lib/session/require";
import { listProductsForAdmin, countPendingProducts } from "@/lib/queries/admin";
import type { ProductStatus } from "@/lib/format/status";
import { aiVerdictPriority } from "@/lib/moderation/verdict";
import { cn } from "@/lib/utils";

export const metadata = { title: "作品管理 | admin" };

const STATUS_FILTERS: Array<{ value: "all" | ProductStatus; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "pending", label: "審査待ち" },
  { value: "published", label: "公開中" },
  { value: "draft", label: "下書き" },
  { value: "suspended", label: "停止中" },
];

interface PageProps {
  searchParams: { q?: string; status?: string; page?: string };
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const page = Number.parseInt(searchParams.page ?? "1", 10) || 1;
  const search = searchParams.q ?? "";
  const status = parseStatus(searchParams.status);

  const [result, pendingCount] = await Promise.all([
    listProductsForAdmin({ page, search, status }),
    countPendingProducts(),
  ]);
  const { total, totalPages } = result;
  // 審査待ち表示では AI が懸念ありとしたもの(block→flag→error)を上に出す。
  const items =
    status === "pending"
      ? [...result.items].sort(
          (a, b) =>
            aiVerdictPriority(b.aiVerdict ?? "skipped") -
            aiVerdictPriority(a.aiVerdict ?? "skipped"),
        )
      : result.items;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { href: "/admin", label: "管理画面", icon: ShieldCheck },
          { label: "作品" },
        ]}
      />
      <AdminPageHeader
        title="作品"
        description="審査待ちの承認・却下、作品の停止・公開復帰・下書き化。操作は監査ログに記録されます。"
        icon={Package}
        tone="indigo"
        count={total}
      />

      {pendingCount > 0 && status !== "pending" && (
        <Link
          href={"/admin/products?status=pending" as Route}
          className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm transition-colors hover:bg-amber-500/15"
        >
          <ClipboardCheck className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="font-medium text-foreground">
            審査待ちの作品が {pendingCount} 件あります
          </span>
          <span className="ml-auto text-muted-foreground">確認する →</span>
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = (status ?? "all") === f.value;
          const href = buildFilterHref(f.value, search);
          return (
            <Link
              key={f.value}
              href={href}
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

      <form className="flex max-w-md items-center gap-2" action="/admin/products">
        <Input
          name="q"
          defaultValue={search}
          placeholder="タイトルで検索…"
          aria-label="タイトルで検索"
        />
        {status && status !== "all" && (
          <input type="hidden" name="status" value={status} />
        )}
        <button
          type="submit"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          検索
        </button>
      </form>

      {items.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            該当する作品が見つかりませんでした。
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <AdminProductRowCard key={p.id} product={p} />
          ))}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} q={search} status={status} />
    </div>
  );
}

function parseStatus(value: string | undefined): ProductStatus | "all" | undefined {
  if (!value) return undefined;
  if (
    value === "all" ||
    value === "draft" ||
    value === "pending" ||
    value === "published" ||
    value === "suspended"
  ) {
    return value;
  }
  return undefined;
}

function buildFilterHref(
  value: "all" | ProductStatus,
  q: string,
): Route {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (value !== "all") params.set("status", value);
  const qs = params.toString();
  return (qs ? `/admin/products?${qs}` : "/admin/products") as Route;
}

function Pagination({
  page,
  totalPages,
  q,
  status,
}: {
  page: number;
  totalPages: number;
  q: string;
  status?: ProductStatus | "all";
}) {
  if (totalPages <= 1) return null;

  const buildHref = (p: number): Route => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status && status !== "all") params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return (qs ? `/admin/products?${qs}` : "/admin/products") as Route;
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
