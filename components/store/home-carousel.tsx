"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReviewBadge } from "@/components/review/review-badge";
import { categoryLabel } from "@/lib/format/category";
import { formatPrice } from "@/lib/format/price";
import type { ProductListItem } from "@/lib/queries/types";
import { cn } from "@/lib/utils";

/**
 * Steam のストアフロント上部にあるような大型フィーチャーカルーセル。
 *
 * 仕様:
 *  - 商品表紙を大きく表示(aspect 21/9)
 *  - 暗オーバーレイの上にタイトル / カテゴリ / 価格 / 評価
 *  - 5 秒で auto-rotate(hover / focus で停止)
 *  - 左右 chevron で手動切替
 *  - 下に dot indicator(クリックで直接 jump)
 *  - 商品全体クリックで /store/[slug] へ
 *
 * Server から渡される products は表示順を持つ ProductListItem[]。
 * coverPath はサーバが解決済 URL を別途渡す必要はなく、
 * <CoverImage src={publicCoverUrl(coverPath)} /> パターンを踏襲したいが、
 * このコンポーネントは Client なので、Server 側で coverUrl 解決済の
 * 配列に変換して渡す前提にする(use-recent-views と同じ方針)。
 */

export interface CarouselItem {
  slug: string;
  title: string;
  coverUrl: string | null;
  productType: ProductListItem["productType"];
  priceJpy: number;
  reviewSummary: ProductListItem["reviewSummary"];
}

const AUTO_ROTATE_MS = 5000;

interface HomeCarouselProps {
  items: CarouselItem[];
}

export function HomeCarousel({ items }: HomeCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = items.length;
  const timerRef = useRef<number | null>(null);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % total);
  }, [total]);
  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + total) % total);
  }, [total]);

  // Auto-rotate
  useEffect(() => {
    if (total <= 1 || paused) return;
    timerRef.current = window.setTimeout(next, AUTO_ROTATE_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [index, paused, total, next]);

  if (total === 0) return null;

  return (
    <section
      className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="カルーセル"
      aria-label="注目の作品"
    >
      {/* スライド本体 */}
      <div className="relative aspect-[21/9] w-full bg-muted">
        {items.map((it, i) => (
          <CarouselSlide
            key={it.slug}
            item={it}
            active={i === index}
            index={i}
            total={total}
          />
        ))}
      </div>

      {/* 左右 chevron(slides > 1 のときだけ表示) */}
      {total > 1 && (
        <>
          <CarouselArrow side="left" onClick={prev} />
          <CarouselArrow side="right" onClick={next} />
        </>
      )}

      {/* Dot indicator */}
      {total > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {items.map((it, i) => (
            <button
              key={it.slug}
              type="button"
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80",
              )}
              aria-label={`スライド ${i + 1} / ${total} に切替`}
              aria-current={i === index ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * 1 枚のスライド。active のときだけ opacity 1、それ以外は 0 + pointer-events
 * none で重ねて配置(layout shift 防止)。
 */
function CarouselSlide({
  item,
  active,
  index,
  total,
}: {
  item: CarouselItem;
  active: boolean;
  index: number;
  total: number;
}) {
  return (
    <Link
      href={`/store/${item.slug}` as Route}
      className={cn(
        "absolute inset-0 block transition-opacity duration-700 ease-out",
        active ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!active}
      aria-label={`「${item.title}」の作品詳細を見る(${index + 1} / ${total})`}
    >
      {/* 背景画像 */}
      <div className="absolute inset-0">
        {item.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverUrl}
            alt={item.title}
            className="h-full w-full object-cover"
            loading={index === 0 ? "eager" : "lazy"}
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
            <ImageIcon className="h-16 w-16" aria-hidden />
          </div>
        )}
      </div>

      {/* 下から上への暗オーバーレイ(文字を読みやすく) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      {/* メタ表示(左下) */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-7">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="category">{categoryLabel(item.productType)}</Badge>
          <ReviewBadge summary={item.reviewSummary} size="sm" />
        </div>
        <h2 className="line-clamp-2 text-xl font-bold tracking-tight drop-shadow-md sm:text-2xl lg:text-3xl">
          {item.title}
        </h2>
        <p className="mt-1.5 text-base font-semibold tracking-tight sm:text-lg">
          {formatPrice(item.priceJpy)}
        </p>
      </div>
    </Link>
  );
}

function CarouselArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "前のスライド" : "次のスライド"}
      className={cn(
        "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}
