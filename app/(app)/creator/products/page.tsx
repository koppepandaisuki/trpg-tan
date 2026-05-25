import Link from "next/link";
import { TopHeader } from "@/components/layout/top-header";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ProductRow } from "@/components/creator/product-row";
import { requireCreator } from "@/lib/session/require";
import { listMyProducts } from "@/lib/queries/creator-products";
import { cn } from "@/lib/utils";

export const metadata = { title: "作品管理 | TRPG プラットフォーム" };

const CREATOR_NAV = [
  { label: "ダッシュボード", href: "/creator/products", current: false, disabled: true },
  { label: "作品管理", href: "/creator/products", current: true },
  { label: "売上・分析", href: "/creator/products", current: false, disabled: true },
  { label: "設定", href: "/creator/products", current: false, disabled: true },
];

export default async function CreatorProductsPage() {
  const user = await requireCreator();
  const products = await listMyProducts(user.id);

  const drafts = products.filter((p) => p.status === "draft");
  const published = products.filter((p) => p.status === "published");
  const suspended = products.filter((p) => p.status === "suspended");

  return (
    <>
      <TopHeader />
      <SidebarLayout
        sidebar={
          <nav className="space-y-1 rounded-lg border border-border bg-card p-2">
            <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              クリエイターメニュー
            </p>
            {CREATOR_NAV.map((item) => (
              <span
                key={item.label}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm",
                  item.current
                    ? "bg-foreground/5 font-medium text-foreground"
                    : "text-muted-foreground",
                  item.disabled && "opacity-60",
                )}
              >
                {item.label}
              </span>
            ))}
          </nav>
        }
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">作品管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              自分の作品 {products.length} 件(公開 {published.length} · 下書き{" "}
              {drafts.length}
              {suspended.length > 0 ? ` · 停止 ${suspended.length}` : ""})
            </p>
          </div>
          <Link
            href="/creator/products/new"
            className={cn(buttonVariants({ variant: "primary" }))}
          >
            <Plus className="h-4 w-4" />
            新しい作品を登録
          </Link>
        </div>

        {products.length === 0 ? (
          <Card className="mt-6 shadow-sm">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              まだ作品がありません。
              <br />
              「新しい作品を登録」からビルダーを開いて作成できます。
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6 space-y-6">
            {published.length > 0 && (
              <Section title="公開中" items={published} />
            )}
            {drafts.length > 0 && <Section title="下書き" items={drafts} />}
            {suspended.length > 0 && (
              <Section title="停止中" items={suspended} />
            )}
          </div>
        )}
      </SidebarLayout>
    </>
  );
}

function Section({
  title,
  items,
}: {
  title: string;
  items: Awaited<ReturnType<typeof listMyProducts>>;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="space-y-2">
        {items.map((p) => (
          <ProductRow key={p.id} product={p} />
        ))}
      </ul>
    </div>
  );
}
