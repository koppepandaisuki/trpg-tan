import Link from "next/link";
import type { Route } from "next";
import { Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { AdminProductRowCard } from "@/components/admin/product-row";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requireAdmin } from "@/lib/session/require";
import { listProductsForAdmin } from "@/lib/queries/admin";
import type { ProductStatus } from "@/lib/format/status";
import { cn } from "@/lib/utils";

export const metadata = { title: "作品管理 | admin" };

const STATUS_FILTERS: Array<{ value: "all" | ProductStatus; label: string }> = [
  { value: "all", label: "すべて" },
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

  const { items, total, totalPages } = await listProductsForAdmin({
    page,
    search,
    status,
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="作品"
        description="作品の停止・公開復帰・下書き化。停止/復帰の操作は監査ログに記録されます。"
        icon={Package}
        tone="indigo"
        count={total}
      />

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
  if (value === "all" || value === "draft" || value === "published" || value === "suspended") {
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
