import type { Route } from "next";
import { Search, PackageOpen, Store as StoreIcon } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <PageContainer className="space-y-6 py-8">
        {/* Hero ヘッダー(サイト全体の視覚言語に統一)。
            ホーム / ライブラリ / 商品詳細と同じ indigo/violet 系で
            「探す」ことの positive さを表現。 */}
        <Card className="overflow-hidden border-border bg-gradient-to-br from-indigo-500/8 via-transparent to-violet-500/8 shadow-sm">
          <CardContent className="relative py-6 sm:py-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />

            <div className="relative z-10 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-indigo-300 bg-indigo-50 text-indigo-700">
                <StoreIcon className="h-5 w-5" aria-hidden />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    ストア
                  </h1>
                  {category && (
                    <Badge variant="category">
                      {categoryLabel(category)}
                    </Badge>
                  )}
                  <Badge variant="muted" className="text-[10px]">
                    {total} 件
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {category
                    ? `「${categoryLabel(category)}」カテゴリの公開作品一覧。タブから他のカテゴリにも切り替えられます。`
                    : "シナリオ / アセット / パッケージなど、公開中の全作品を表示しています。"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <CategoryTabs current={category} />
        </div>

        <div>
          {items.length === 0 ? (
            category ? (
              // フィルタ適用中で 0 件 → フィルタ解除を促す
              <EmptyState
                icon={Search}
                title="該当する作品が見つかりませんでした"
                description={`「${categoryLabel(category)}」カテゴリの公開作品はまだありません。別のカテゴリも見てみてください。`}
                primaryAction={{
                  href: "/store",
                  label: "すべての作品を見る",
                }}
                secondaryAction={{ href: "/", label: "ホームに戻る" }}
              />
            ) : (
              // 全件 0 件 → creator になる導線 / ホームに戻る
              <EmptyState
                icon={PackageOpen}
                title="公開中の作品はまだありません"
                description="クリエイターが作品を公開すると、ここに表示されます。あなたが最初のクリエイターになりませんか?"
                primaryAction={{
                  href: "/creator/products/new",
                  label: "作品を投稿する",
                }}
                secondaryAction={{ href: "/", label: "ホームに戻る" }}
              />
            )
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
