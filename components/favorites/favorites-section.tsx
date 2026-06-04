"use client";

import Link from "next/link";
import type { Route } from "next";
import { Heart, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useFavorites } from "@/hooks/use-favorites";
import { categoryLabel } from "@/lib/format/category";
import { formatPrice } from "@/lib/format/price";

/**
 * 「お気に入り」strip 表示。RecentlyViewed と同じ Client-safe な構造。
 *
 * 仕様:
 *  - 0 件のときは何も描画しない
 *  - 横スクロール strip(ProductStrip と同じ touch)
 *  - 内部の card は server-only モジュールに依存しない inline 実装
 *    (coverUrl は localStorage 解決済 URL を使う)
 *
 * RecentlyViewed と非常に似ているが、別 component にして責任を分離する
 * (履歴 vs お気に入りという「意味」が違う)。
 */
interface FavoritesSectionProps {
  /** 自分の slug は出さないように除外(商品詳細で使う想定)*/
  excludeSlug?: string;
}

export function FavoritesSection({ excludeSlug }: FavoritesSectionProps) {
  const items = useFavorites();
  const visible = excludeSlug
    ? items.filter((it) => it.slug !== excludeSlug)
    : items;

  if (visible.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600">
            <Heart className="h-4 w-4 fill-current" aria-hidden />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-lg font-semibold tracking-tight">お気に入り</h2>
            <p className="text-xs text-muted-foreground">
              この端末で保存した作品(プライベート)
            </p>
          </div>
        </div>
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
              <FavoriteCard
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
 * 内部 card。WorkCard を直接使えない(server-only に依存)ため inline 実装。
 */
function FavoriteCard({
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
