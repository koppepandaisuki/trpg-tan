"use client";

import Link from "next/link";
import type { Route } from "next";
import { History, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useRecentViews, useClearRecentViews } from "@/hooks/use-recent-views";
import { categoryLabel } from "@/lib/format/category";
import { formatPrice } from "@/lib/format/price";

/**
 * 「最近見た作品」strip 表示。Client Component(localStorage に依存)。
 *
 * 仕様:
 *  - 0 件のときは何も描画しない(空セクションは出さない)
 *  - excludeSlug が指定されたらそれを除外(商品詳細ページに mount して
 *    「今見てる作品」を一覧に出さない)
 *  - 視覚は WorkCard と同じトーンだが、storage の server-only モジュール
 *    依存を避けるため独自の inline card 実装(coverUrl は localStorage に
 *    解決済 URL が入っている前提)
 *  - 履歴のクリアボタンを右上に置く(プライバシー / 制御感の提供)
 */
interface RecentlyViewedProps {
  /** 自分の slug は出さないように除外(商品詳細で使う想定)*/
  excludeSlug?: string;
  /** セクション見出しの上書き(省略時は「最近見た作品」)*/
  title?: string;
}

export function RecentlyViewed({
  excludeSlug,
  title = "最近見た作品",
}: RecentlyViewedProps) {
  const items = useRecentViews();
  const clear = useClearRecentViews();

  const visible = excludeSlug
    ? items.filter((it) => it.slug !== excludeSlug)
    : items;

  if (visible.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700">
            <History className="h-4 w-4" aria-hidden />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <p className="text-xs text-muted-foreground">
              直近で詳細を開いた作品(この端末のみ)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={clear}
          className="text-xs text-muted-foreground transition hover:text-foreground"
          aria-label="最近見た作品の履歴をクリア"
        >
          履歴をクリア
        </button>
      </div>

      <div className="-mx-4 sm:-mx-6">
        <ul
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:px-6"
          style={{ scrollbarWidth: "thin" }}
        >
          {visible.map((it) => (
            <li
              key={it.slug}
              className="w-[180px] shrink-0 snap-start sm:w-[200px] lg:w-[220px]"
            >
              <RecentCard
                slug={it.slug}
                title={it.title}
                coverUrl={it.coverUrl}
                productType={it.productType}
                priceJpy={it.priceJpy}
                systemLabel={it.systemLabel}
                creatorDisplayName={it.creator.displayName}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * RecentlyViewed 内部用のコンパクトな商品カード。
 *
 * WorkCard と視覚は揃えるが、`lib/format/storage.ts` (server-only) に
 * 依存しないように Client-safe な実装にする。coverUrl は localStorage に
 * 「解決済の完全 URL」が入っている前提。
 */
function RecentCard({
  slug,
  title,
  coverUrl,
  productType,
  priceJpy,
  systemLabel,
  creatorDisplayName,
}: {
  slug: string;
  title: string;
  coverUrl: string | null;
  productType: import("@/lib/queries/types").ProductType;
  priceJpy: number;
  systemLabel: string | null;
  creatorDisplayName: string;
}) {
  return (
    <Link
      href={`/store/${slug}` as Route}
      className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`「${title}」の作品詳細を見る`}
    >
      <Card className="overflow-hidden border-border shadow-sm transition-all group-hover:border-foreground/20 group-hover:shadow-card">
        <div className="aspect-[16/10] overflow-hidden bg-muted">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt={title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-8 w-8" aria-hidden />
            </div>
          )}
        </div>
        <CardContent className="space-y-1.5 p-4">
          <Badge variant="category">{categoryLabel(productType)}</Badge>
          <p className="line-clamp-2 text-base font-semibold leading-snug tracking-tight transition-colors group-hover:text-accent">
            {title}
          </p>
          {systemLabel && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {systemLabel}
            </p>
          )}
          {creatorDisplayName && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {creatorDisplayName}
            </p>
          )}
          <p className="pt-1 text-base font-semibold tracking-tight">
            {formatPrice(priceJpy)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
