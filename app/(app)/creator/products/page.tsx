import Link from "next/link";
import { TopHeader } from "@/components/layout/top-header";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { buttonVariants } from "@/components/ui/button";
import { Plus, PenSquare } from "lucide-react";
import { ProductRow } from "@/components/creator/product-row";
import { BulkUnpublishButton } from "@/components/creator/bulk-unpublish-button";
import { CreatorNav } from "@/components/creator/creator-nav";
import { EmptyState } from "@/components/store/empty-state";
import { requireCreator } from "@/lib/session/require";
import { listMyProducts } from "@/lib/queries/creator-products";
import { cn } from "@/lib/utils";

export const metadata = { title: "作品管理" };

export default async function CreatorProductsPage() {
  const user = await requireCreator();
  const products = await listMyProducts(user.id);

  const drafts = products.filter((p) => p.status === "draft");
  const published = products.filter((p) => p.status === "published");
  const suspended = products.filter((p) => p.status === "suspended");

  return (
    <>
      <TopHeader />
      <SidebarLayout sidebar={<CreatorNav current="products" />}>
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
          <div className="mt-6">
            <EmptyState
              icon={PenSquare}
              title="まだ作品がありません"
              description={
                user.stripeChargesEnabled
                  ? "「新しい作品を登録」からビルダーを開いて、シナリオ / アセット / パッケージを公開できます。"
                  : "「新しい作品を登録」からビルダーを開いて作成できます。価格 ¥0(無料)なら Stripe 接続未完了でも公開可、有料販売は Stripe 接続が必要です。"
              }
              primaryAction={{
                href: "/creator/products/new",
                label: "新しい作品を登録",
              }}
              secondaryAction={
                user.stripeChargesEnabled
                  ? undefined
                  : { href: "/creator/onboarding", label: "Stripe 接続を設定" }
              }
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {published.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    公開中
                  </h2>
                  {/* 一括非公開(RRRRR): 活動休止したい creator 向け */}
                  <BulkUnpublishButton publishedCount={published.length} />
                </div>
                <ul className="space-y-2">
                  {published.map((p) => (
                    <ProductRow key={p.id} product={p} />
                  ))}
                </ul>
              </div>
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
