import Link from "next/link";
import type { Route } from "next";
import {
  Users,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/store/cover-image";
import { EmptyState } from "@/components/store/empty-state";
import { CreatorSearchBar } from "@/components/creator/creator-search-bar";
import { buttonVariants } from "@/components/ui/button";
import { listPublicCreators, type CreatorSort } from "@/lib/queries/creators";
import { publicAvatarUrl } from "@/lib/format/storage";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "クリエイター",
  description:
    "パラDa-iCE TRPGサイトで公開作品を持つクリエイターの一覧。作品数の多い順。",
};

interface CreatorsPageProps {
  searchParams: { page?: string; sort?: string; q?: string };
}

function parseSort(value: string | undefined): CreatorSort {
  if (value === "sales") return "sales";
  return "products";
}

/**
 * /creators — 公開作品を 1 つ以上持つクリエイターの一覧。
 *
 * 並び順は「公開作品数の多い順」。α 期間中は数十人規模を想定。
 * RPC 化は将来課題(lib/queries/creators.ts 内コメント参照)。
 *
 * 表示要素:
 *  - hero ヘッダー(Users アイコン + 件数バッジ)
 *  - 4 列グリッドのカード(アバター + 名前 + 作品数 + bio 抜粋)
 *  - 0 件状態は「最初のクリエイターになりませんか?」誘導
 *  - ページネーション(前へ/次へ + 現在ページ)
 */
export default async function CreatorsPage({ searchParams }: CreatorsPageProps) {
  const page = Number.parseInt(searchParams.page ?? "1", 10) || 1;
  const sort = parseSort(searchParams.sort);
  const q =
    typeof searchParams.q === "string" &&
    searchParams.q.trim() !== "" &&
    searchParams.q.length <= 50
      ? searchParams.q.trim()
      : null;
  const { items, total, totalPages } = await listPublicCreators({
    page,
    sort,
    q,
  });

  // ページネーション URL は sort / q を維持しつつ page だけ差し替える
  const buildHref = (p: number): Route => {
    const params = new URLSearchParams();
    if (sort === "sales") params.set("sort", "sales");
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return (qs ? `/creators?${qs}` : "/creators") as Route;
  };

  // ソート切替 URL は page をリセットして 1 ページ目に戻す(q は維持)
  const buildSortHref = (s: CreatorSort): Route => {
    const params = new URLSearchParams();
    if (s === "sales") params.set("sort", "sales");
    if (q) params.set("q", q);
    const qs = params.toString();
    return (qs ? `/creators?${qs}` : "/creators") as Route;
  };

  return (
    <>
      <TopHeader />
      <PageContainer className="space-y-6 py-8">
        <Breadcrumb items={[{ label: "クリエイター", icon: Users }]} />

        {/* Hero ヘッダー(他ページと統一の視覚言語) */}
        <Card className="overflow-hidden border-border bg-gradient-to-br from-rose-500/8 via-transparent to-indigo-500/8 shadow-sm">
          <CardContent className="relative py-6 sm:py-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-rose-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />

            <div className="relative z-10 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-rose-300 bg-rose-50 text-rose-700">
                <Users className="h-5 w-5" aria-hidden />
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    クリエイター
                  </h1>
                  {/* 検索キーワード chip(OOOOO)。クリックで解除 */}
                  {q && (
                    <Link
                      href={
                        (sort === "sales"
                          ? "/creators?sort=sales"
                          : "/creators") as Route
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800 transition hover:border-rose-300 hover:bg-rose-100"
                      aria-label={`検索「${q}」を解除`}
                    >
                      <Search className="h-3 w-3" aria-hidden />
                      <span>「{q}」</span>
                      <X className="h-3 w-3" aria-hidden />
                    </Link>
                  )}
                  <Badge variant="muted" className="text-[10px]">
                    {total} 名
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {q
                    ? `「${q}」を名前に含むクリエイターの検索結果です。`
                    : "公開作品を 1 つ以上お持ちのクリエイターを表示しています。"}
                </p>
                {/* クリエイター名検索バー(OOOOO)*/}
                <CreatorSearchBar />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ソート切替 tabs(FFFF)*/}
        <nav className="flex flex-wrap gap-1 border-b border-border" aria-label="並べ替え">
          {[
            { value: "products" as const, label: "作品数順" },
            { value: "sales" as const, label: "売上順" },
          ].map((opt) => {
            const isActive = sort === opt.value;
            return (
              <Link
                key={opt.value}
                href={buildSortHref(opt.value)}
                className={cn(
                  "rounded-t-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "border-b-2 border-foreground font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {opt.label}
              </Link>
            );
          })}
        </nav>

        {/* グリッド or 空状態 */}
        {items.length === 0 ? (
          q ? (
            // 検索で 0 件 → 検索解除導線
            <EmptyState
              icon={UserPlus}
              title={`「${q}」に一致するクリエイターが見つかりませんでした`}
              description="名前を変えるか、検索を解除してすべてのクリエイターから探してみてください。"
              primaryAction={{
                href: "/creators",
                label: "すべてのクリエイターを見る",
              }}
              secondaryAction={{ href: "/", label: "ホームに戻る" }}
            />
          ) : (
            <EmptyState
              icon={UserPlus}
              title="まだクリエイターが登録されていません"
              description="作品を公開すると、ここに表示されます。あなたが最初のクリエイターになりませんか?"
              primaryAction={{
                href: "/creator/products/new",
                label: "作品を投稿する",
              }}
              secondaryAction={{ href: "/", label: "ホームに戻る" }}
            />
          )
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((c) => (
              <li key={c.id}>
                <CreatorCard
                  id={c.id}
                  displayName={c.displayName}
                  avatarUrl={publicAvatarUrl(c.avatarPath)}
                  bio={c.bio}
                  productCount={c.productCount}
                  totalSales={sort === "sales" ? c.totalSales : null}
                />
              </li>
            ))}
          </ul>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav
            aria-label="ページネーション"
            className="flex items-center justify-center gap-3 pt-4 text-sm"
          >
            <Link
              href={buildHref(Math.max(1, page - 1))}
              aria-disabled={page <= 1}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                page <= 1 && "pointer-events-none opacity-50",
              )}
            >
              <ChevronLeft className="h-4 w-4" />
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
              <ChevronRight className="h-4 w-4" />
            </Link>
          </nav>
        )}
      </PageContainer>
    </>
  );
}

/**
 * 1 人のクリエイター用カード。カード全体が `/creator/[id]` リンク。
 * アバター + 名前 + 作品数 + bio 冒頭 2 行。
 */
function CreatorCard({
  id,
  displayName,
  avatarUrl,
  bio,
  productCount,
  totalSales,
}: {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  productCount: number;
  /** sort=sales のときのみ表示。null なら隠す。*/
  totalSales: number | null;
}) {
  const name = displayName || "(名称未設定)";

  return (
    <Link
      href={`/creator/${id}` as Route}
      className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`${name} のプロフィールを見る`}
    >
      <Card className="h-full overflow-hidden border-border shadow-sm transition-all group-hover:border-foreground/20 group-hover:shadow-card">
        <CardContent className="space-y-3 py-5">
          <div className="flex items-start gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
              <CoverImage
                src={avatarUrl}
                alt={`${name} のアバター`}
                aspect="aspect-square"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-base font-semibold tracking-tight transition-colors group-hover:text-accent">
                {name}
              </p>
              <div className="flex flex-wrap items-center gap-1">
                <Badge variant="muted" className="text-[10px]">
                  公開作品 {productCount} 件
                </Badge>
                {typeof totalSales === "number" && (
                  <Badge variant="category" className="text-[10px]">
                    累計購入 {totalSales} 件
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {bio ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {bio}
            </p>
          ) : (
            <p className="text-xs italic text-muted-foreground/60">
              自己紹介は未設定
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
