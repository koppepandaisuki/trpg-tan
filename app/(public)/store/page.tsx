import Link from "next/link";
import type { Route } from "next";
import {
  Search,
  PackageOpen,
  Store as StoreIcon,
  X,
  Tag,
  JapaneseYen,
} from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryTabs } from "@/components/store/category-tabs";
import { CuratedTagRail } from "@/components/store/curated-tag-rail";
import { WorkCard } from "@/components/store/work-card";
import { EmptyState } from "@/components/store/empty-state";
import { StorePagination } from "@/components/store/pagination";
import {
  listPublishedProducts,
  type StoreSort,
} from "@/lib/queries/products";
import { parseCategoryParam, categoryLabel } from "@/lib/format/category";
import {
  parsePriceFilter,
  priceFilterLabel,
  STORE_PRICE_FILTERS,
  type StorePriceFilter,
} from "@/lib/format/price";
import { cn } from "@/lib/utils";

export const metadata = { title: "ストア" };

interface StorePageProps {
  searchParams: {
    category?: string;
    tag?: string;
    q?: string;
    price?: string;
    sort?: string;
    page?: string;
  };
}

function parseSort(value: string | undefined): StoreSort {
  if (value === "rating") return "rating";
  return "published";
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
  // q(検索キーワード)。空 / 100 字超は無視。
  const q =
    typeof searchParams.q === "string" &&
    searchParams.q.trim() !== "" &&
    searchParams.q.length <= 100
      ? searchParams.q.trim()
      : null;
  const sort = parseSort(searchParams.sort);
  const price = parsePriceFilter(searchParams.price);
  const page = Number.parseInt(searchParams.page ?? "1", 10) || 1;

  const { items, totalPages, total } = await listPublishedProducts({
    category,
    tag,
    q,
    price,
    sort,
    page,
  });

  // 全フィルタ(category / tag / q / price / sort / page)から /store URL を
  // 組み立てる単一ヘルパ。各導線は現在の状態に override を被せて呼ぶことで、
  // フィルタの取りこぼし(例: 価格だけ消える)を防ぐ。
  const storeHref = (p: {
    category?: string | null;
    tag?: string | null;
    q?: string | null;
    price?: StorePriceFilter | null;
    sort?: StoreSort;
    page?: number;
  }): Route => {
    const params = new URLSearchParams();
    if (p.category) params.set("category", p.category);
    if (p.tag) params.set("tag", p.tag);
    if (p.q) params.set("q", p.q);
    if (p.price) params.set("price", p.price);
    if (p.sort === "rating") params.set("sort", "rating");
    if (p.page && p.page > 1) params.set("page", String(p.page));
    const qs = params.toString();
    return (qs ? `/store?${qs}` : "/store") as Route;
  };

  // ページネーション: page だけ差し替え、他は維持。
  const buildHref = (p: number): Route =>
    storeHref({ category, tag, q, price, sort, page: p });
  // タグ / 検索 / 価格を個別に外す導線(他は維持、page はリセット)。
  const removeTagHref = storeHref({ category, tag: null, q, price, sort });
  const removeQueryHref = storeHref({ category, tag, q: null, price, sort });
  const removePriceHref = storeHref({ category, tag, q, price: null, sort });
  // ソート / 価格切替(page はリセットして 1 ページ目へ)。
  const buildSortHref = (s: StoreSort): Route =>
    storeHref({ category, tag, q, price, sort: s });
  const buildPriceHref = (pr: StorePriceFilter): Route =>
    storeHref({ category, tag, q, price: pr, sort });

  return (
    <>
      <TopHeader />
      <PageContainer className="space-y-6 py-8">
        {/* Hero ヘッダー(サイト全体の視覚言語に統一)。
            ホーム / ライブラリ / 商品詳細と同じ indigo/violet 系で
            「探す」ことの positive さを表現。 */}
        <Card className="overflow-hidden border-border bg-gradient-to-br from-red-500/8 via-transparent to-amber-500/8 shadow-sm">
          <CardContent className="relative py-6 sm:py-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-red-500/10 blur-3xl" />

            <div className="relative z-10 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-700">
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
                  {/* 検索キーワード chip。クリックで外せる */}
                  {q && (
                    <Link
                      href={removeQueryHref}
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800 transition hover:border-red-300 hover:bg-red-100"
                      aria-label={`検索「${q}」を解除`}
                    >
                      <Search className="h-3 w-3" aria-hidden />
                      <span>「{q}」</span>
                      <X className="h-3 w-3" aria-hidden />
                    </Link>
                  )}
                  {/* タグフィルタ chip。クリックで外せる(削除アイコン付き)*/}
                  {tag && (
                    <Link
                      href={removeTagHref}
                      className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 transition hover:border-amber-300 hover:bg-amber-100"
                      aria-label={`タグ「${tag}」のフィルタを外す`}
                    >
                      <Tag className="h-3 w-3" aria-hidden />
                      <span>#{tag}</span>
                      <X className="h-3 w-3" aria-hidden />
                    </Link>
                  )}
                  {/* 価格フィルタ chip。クリックで外せる */}
                  {price && (
                    <Link
                      href={removePriceHref}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
                      aria-label={`価格「${priceFilterLabel(price)}」のフィルタを外す`}
                    >
                      <JapaneseYen className="h-3 w-3" aria-hidden />
                      <span>{priceFilterLabel(price)}</span>
                      <X className="h-3 w-3" aria-hidden />
                    </Link>
                  )}
                  <Badge variant="muted" className="text-[10px]">
                    {total} 件
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {buildDescription(category, tag, q)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <CategoryTabs current={category} />
        </div>

        {/* テーマで探す(キュレーション探索タグ)。カテゴリ(商品タイプ)とは
            別軸で、遊びやすさ・時間・人数・雰囲気からタグ検索に飛ばす。 */}
        <CuratedTagRail current={tag} />

        {/* 価格で絞り込み(無料 / 価格帯)。category / sort とは独立。 */}
        <nav
          aria-label="価格で絞り込み"
          className="flex flex-wrap items-center gap-2 text-xs"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            価格
          </span>
          <Link
            href={removePriceHref}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition",
              price === null
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
            aria-current={price === null ? "page" : undefined}
          >
            すべて
          </Link>
          {STORE_PRICE_FILTERS.map((f) => {
            const isActive = price === f.value;
            return (
              <Link
                key={f.value}
                href={buildPriceHref(f.value)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition",
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {f.label}
              </Link>
            );
          })}
        </nav>

        {/* ソート切替(新着順 / 好評順)。フィルタ + ソートは独立に
            選べる。category-tabs と並ぶが、別行で「2 つの軸」感を明示。 */}
        <nav
          aria-label="並べ替え"
          className="flex flex-wrap items-center gap-2 text-xs"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            並べ替え
          </span>
          {[
            { value: "published" as const, label: "新着順" },
            { value: "rating" as const, label: "好評順" },
          ].map((opt) => {
            const isActive = sort === opt.value;
            return (
              <Link
                key={opt.value}
                href={buildSortHref(opt.value)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition",
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {opt.label}
              </Link>
            );
          })}
        </nav>

        <div>
          {items.length === 0 ? (
            q ? (
              // 検索で 0 件 → 検索を外す導線
              <EmptyState
                icon={Search}
                title={`「${q}」に一致する作品が見つかりませんでした`}
                description="キーワードを変えるか、検索を解除してすべての作品から探してみてください。"
                primaryAction={{
                  href: removeQueryHref,
                  label: "検索を解除する",
                }}
                secondaryAction={{ href: "/", label: "ホームに戻る" }}
              />
            ) : tag ? (
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
            ) : price ? (
              // 価格絞り込みで 0 件 → 価格条件を外す導線
              <EmptyState
                icon={Search}
                title={`「${priceFilterLabel(price)}」の作品が見つかりませんでした`}
                description="価格の条件を変えるか、外してすべての価格帯から探してみてください。"
                primaryAction={{
                  href: removePriceHref,
                  label: "価格条件を外す",
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
  q: string | null,
): string {
  // 検索がある場合は最優先で文面に含める(ユーザーの最近のアクション)
  if (q) {
    const scope = category
      ? `「${categoryLabel(category as never)}」カテゴリ内で`
      : "";
    return `${scope}「${q}」を作品名・作者・タグから検索した結果です。`;
  }
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
