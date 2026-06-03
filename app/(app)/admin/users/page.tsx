import Link from "next/link";
import type { Route } from "next";
import { Users, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { UserRow } from "@/components/admin/user-row";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { requireAdmin } from "@/lib/session/require";
import { listUsersForAdmin } from "@/lib/queries/admin";
import { cn } from "@/lib/utils";

export const metadata = { title: "ユーザー管理 | admin" };

interface PageProps {
  searchParams: { q?: string; page?: string };
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const admin = await requireAdmin();
  const page = Number.parseInt(searchParams.page ?? "1", 10) || 1;
  const search = searchParams.q ?? "";

  const { items, total, totalPages } = await listUsersForAdmin({
    page,
    search,
  });

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { href: "/admin", label: "管理画面", icon: ShieldCheck },
          { label: "ユーザー" },
        ]}
      />
      <AdminPageHeader
        title="ユーザー"
        description="creator 権限の付与・剥奪を管理。すべての操作は監査ログに記録されます。"
        icon={Users}
        tone="slate"
        count={total}
      />

      <form className="flex max-w-md items-center gap-2" action="/admin/users">
        <Input
          name="q"
          defaultValue={search}
          placeholder="表示名で検索…"
          aria-label="表示名で検索"
        />
        <button
          type="submit"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          検索
        </button>
        {search && (
          <Link
            href="/admin/users"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            クリア
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            該当するユーザーが見つかりませんでした。
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((u) => (
            <UserRow key={u.id} user={u} isSelf={u.id === admin.id} />
          ))}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} q={search} />
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  q,
}: {
  page: number;
  totalPages: number;
  q: string;
}) {
  if (totalPages <= 1) return null;

  const buildHref = (p: number): Route => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return (qs ? `/admin/users?${qs}` : "/admin/users") as Route;
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
