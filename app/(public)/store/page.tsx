import Link from "next/link";
import type { Route } from "next";
import { Search, PackageOpen, Store as StoreIcon, X, Tag } from "lucide-react";
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

export const metadata = { title: "ストア" };

interface StorePageProps {
  searchParams: {
    category?: string;
    tag?: string;
    page?: string;
  };
}

export default async function StorePage({ searchParams }: StorePageProps) {
  const category = parseCategoryParam(searchParams.category);
  // tag は string か否か(空文字は無視)。100 字制限で安全側
  const tag =
    typeof searchParams.tag === "string" &&
    searchParams.tag.trim() !== "" &&
    searchParams.tag.length <= 100
      ? searchParams.tag.trim().toLowerCase()
      : null;
  const page = Number.parseInt(searchParams.page ?? "1", 10) || 1;

  const { items, totalPages, total } = await listPublishedProducts({
    category,
    tag,
    page,
  });

  // ページネーション URL は category / tag を全て維持しつつ page だけ
  // 差し替える。フィルタが組み合わさっていても破綻しない設計。
  const buildHref = (p: number): Route => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (tag) params.set("tag", tag);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return (qs ? `/store?${qs}` : "/store") as Route;
  };

  // 「タグフィルタを外す」URL は他の filter は維持
  const removeTagHref: Route = (() => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    const qs = params.toString();
    return (qs ? `/store?${qs}` : "/store") as Route;
  })();

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
                    <Badge variant="category">{categoryLabel(category)}</Badge>
                  )}
                  {/* タグフィルタ chip。クリックで外せる(削除アイコン付き)*/}
                  {tag && (
                    <Link
                      href={removeTagHref}
                      className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800 transition hover:border-violet-300 hover:bg-violet-100"
                      aria-label={`タグ「${tag}」のフィルタを外す`}
                    >
                      <Tag className="h-3 w-3" aria-hidden />
                      <span>#{tag}</span>
                      <X className="h-3 w-3" aria-hidden />
                    </Link>
                  )}
                  <Badge variant="muted" className="text-[10px]">
                    {total} 件
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {buildDescription(category, tag)}
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
            tag ? (
              // タグ検索で 0 件 → タグを外す導線
              <EmptyState
                icon={Search}
                title={`タグ「${tag}」の作品が見つかりませんでした`}
                description="このタグが付いた公開作品はまだありません。別のタグや、すべての作品も見てみてください。"
                primaryAction={{
                  href: removeTagHref,
                  label: "タグフィルタを外す",
                }}
                secondaryAction={{ href: "/", label: "ホームに戻る" }}
              />
            ) : category ? (
              // カテゴリで 0 件 → カテゴリ解除
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
              // 全件 0 件 → creator になる導線
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
            <ul
              className={
                // Responsive grid:
                //  - 2 cols on mobile(< 640)
                //  - 3 cols on sm+(≥ 640)
                //  - 4 cols on lg+(≥ 1024)
                //  - 5 cols on xl+(≥ 1280)
                "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 lg:gap-y-8 xl:grid-cols-5"
              }
            >
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

/**
 * Hero の説明文をフィルタ状況に応じて切替。
 * カテゴリ × タグ の組合せも自然な日本語で表現する。
 */
function buildDescription(
  category: string | null,
  tag: string | null,
): string {
  if (tag && category) {
    return `「${categoryLabel(category as never)}」かつタグ「#${tag}」が付いた公開作品一覧。`;
  }
  if (tag) {
    return `タグ「#${tag}」が付いた公開作品一覧。`;
  }
  if (category) {
    return `「${categoryLabel(category as never)}」カテゴリの公開作品一覧。タブから他のカテゴリにも切り替えられます。`;
  }
  return "シナリオ / アセット / パッケージなど、公開中の全作品を表示しています。";
}
