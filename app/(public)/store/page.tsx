import type { Route } from "next";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { CategoryTabs } from "@/components/store/category-tabs";
import { WorkCard } from "@/components/store/work-card";
import { EmptyState } from "@/components/store/empty-state";
import { StorePagination } from "@/components/store/pagination";
import { listPublishedProducts } from "@/lib/queries/products";
import { parseCategoryParam, categoryLabel } from "@/lib/format/category";

export const metadata = { title: "ストア | TRPG プラットフォーム" };

interface StorePageProps {
  searchParams: {
    category?: string;
    page?: string;
  };
}

export default async function StorePage({ searchParams }: StorePageProps) {
  const category = parseCategoryParam(searchParams.category);
  const page = Number.parseInt(searchParams.page ?? "1", 10) || 1;

  const { items, totalPages, total } = await listPublishedProducts({
    category,
    page,
  });

  const buildHref = (p: number): Route => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return (qs ? `/store?${qs}` : "/store") as Route;
  };

  return (
    <>
      <TopHeader />
      <PageContainer className="py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ストア</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {category
                ? `カテゴリ: ${categoryLabel(category)}(${total}件)`
                : `公開中の作品(${total}件)`}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <CategoryTabs current={category} />
        </div>

        <div className="mt-6">
          {items.length === 0 ? (
            <EmptyState
              title={
                category
                  ? "該当する作品が見つかりませんでした"
                  : "公開中の作品はまだありません"
              }
              description={
                category
                  ? "別のカテゴリも見てみてください。"
                  : "クリエイターが作品を公開すると、ここに表示されます。"
              }
              resetHref={category ? "/store" : undefined}
              resetLabel={category ? "すべての作品を見る" : undefined}
            />
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((product) => (
                <li key={product.id}>
                  <WorkCard product={product} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <StorePagination page={page} totalPages={totalPages} buildHref={buildHref} />
      </PageContainer>
    </>
  );
}
