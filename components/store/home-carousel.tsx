"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  User as UserIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReviewBadge } from "@/components/review/review-badge";
import { useSwipe } from "@/hooks/use-swipe";
import { categoryLabel } from "@/lib/format/category";
import { PriceTag } from "./price-tag";
import type { ProductListItem } from "@/lib/queries/types";
import { cn } from "@/lib/utils";

/**
 * Steam ストアフロント上部の大型フィーチャーカルーセル。
 *
 * レイアウト(WWWW で Steam に近づけた完全形):
 *  - デスクトップ(lg+): 中央 大スライド + 右側 4 枚の縦サムネ列(2 カラム
 *    grid `1fr 200px`)。サムネクリックで該当スライドへ切替、active は
 *    リング + 半透明オーバーレイ解除で強調。
 *  - モバイル / タブレット: 大スライドのみ + 下に dot indicator
 *    (サムネ列を隠す、画面領域に余裕がない)
 *
 * 動作:
 *  - 5 秒で auto-rotate(hover / focus で停止)
 *  - 左右 chevron で手動切替
 *  - 大スライドクリックで /store/[slug] へ
 *  - サムネは小さいので、クリック判定は「該当スライドに切替」のみ
 *    (詳細遷移したいなら active 化 → 大スライドをクリック)
 *
 * coverUrl は Server 側で publicCoverUrl 解決済を渡す前提(Client は
 * server-only に依存しない)。
 */

export interface CarouselItem {
  slug: string;
  title: string;
  coverUrl: string | null;
  productType: ProductListItem["productType"];
  priceJpy: number;
  discountPercent: number;
  discountStartsAt: string | null;
  discountEndsAt: string | null;
  reviewSummary: ProductListItem["reviewSummary"];
  creator: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

const AUTO_ROTATE_MS = 5000;
const THUMBNAIL_COUNT = 4; // 右側に出す枚数(2x2 でも縦 4 でも対応)

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

  useEffect(() => {
    if (total <= 1 || paused) return;
    timerRef.current = window.setTimeout(next, AUTO_ROTATE_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [index, paused, total, next]);

  // モバイルスワイプ(HHHHH)。MediaGallery と同じ useSwipe hook を再利用。
  // 左にスワイプ = 次のスライド、右 = 前。CarouselSlide (Link) の onClick
  // で consumeWasSwiping() を呼んで、swipe 中の tap で詳細遷移しないように。
  const swipe = useSwipe({
    onSwipeLeft: next,
    onSwipeRight: prev,
  });

  if (total === 0) return null;

  // 右側に出すサムネ。常に index を中心にした連続 4 枚(wrap して循環)
  // にして「次に来る候補が見える」UX にする。
  const thumbnailItems = computeThumbnailItems(items, index);

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
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px]">
        {/* メインスライド領域(モバイルスワイプ対応)*/}
        <div
          className="relative aspect-[21/9] w-full bg-muted lg:aspect-auto touch-pan-y"
          onTouchStart={swipe.onTouchStart}
          onTouchMove={swipe.onTouchMove}
          onTouchEnd={swipe.onTouchEnd}
        >
          {items.map((it, i) => (
            <CarouselSlide
              key={it.slug}
              item={it}
              active={i === index}
              index={i}
              total={total}
              consumeWasSwiping={swipe.consumeWasSwiping}
            />
          ))}

          {/* chevron(slides > 1 のとき) */}
          {total > 1 && (
            <>
              <CarouselArrow side="left" onClick={prev} />
              <CarouselArrow side="right" onClick={next} />
            </>
          )}

          {/* モバイル / タブレット用 dot indicator
              (デスクトップではサムネ列が代替なので非表示) */}
          {total > 1 && (
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 lg:hidden">
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
        </div>

        {/* 右側パネル(デスクトップのみ表示)。
            上: サムネ列、下: active 商品の info pane(価格 + 評価 + 発行元)。
            grid-rows で「サムネ群が伸縮 + info pane は固定高さ」にする。 */}
        {total > 1 ? (
          <div className="hidden flex-col border-l border-border bg-muted/40 lg:flex">
            <ul
              className="flex flex-1 flex-col gap-2 overflow-y-auto p-3"
              aria-label="他の作品サムネイル"
            >
              {thumbnailItems.map(({ item, originalIndex }) => (
                <li key={item.slug}>
                  <ThumbnailButton
                    item={item}
                    active={originalIndex === index}
                    onClick={() => setIndex(originalIndex)}
                  />
                </li>
              ))}
            </ul>
            <InfoPane item={items[index]} />
          </div>
        ) : (
          // total === 1 のときはサムネ列が無意味なので info pane だけ表示
          <div className="hidden border-l border-border bg-muted/40 lg:block">
            <InfoPane item={items[0]} />
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Steam の右下に出る商品 info pane の相当物。active な商品の
 *   - レビュー集計 Badge(GGGG の共通 chip)
 *   - 発行元(creator avatar + displayName、クリックで /creator/[id])
 *   - 価格(大きめ強調)
 * を縦に並べる。詳細遷移は大スライドクリックでも届くが、ここの
 * 「詳細を見る」ボタンでも到達できるよう Link を持たせる。
 */
function InfoPane({ item }: { item: CarouselItem }) {
  return (
    <div className="space-y-2.5 border-t border-border bg-card p-3 text-xs">
      {/* レビュー(評価が無いものは見出しごと何も出さない)*/}
      {item.reviewSummary && item.reviewSummary.total > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            評価
          </p>
          <ReviewBadge summary={item.reviewSummary} size="sm" />
        </div>
      )}

      {/* 発行元(creator)*/}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          発行元
        </p>
        <Link
          href={`/creator/${item.creator.id}` as Route}
          className="group inline-flex max-w-full items-center gap-2 rounded-sm transition hover:opacity-80"
        >
          <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
            {item.creator.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.creator.avatarUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <UserIcon className="h-3 w-3" aria-hidden />
              </div>
            )}
          </div>
          <span className="line-clamp-1 text-[11px] font-medium text-foreground/90 group-hover:text-accent">
            {item.creator.displayName || "(名称未設定)"}
          </span>
        </Link>
      </div>

      {/* 価格 */}
      <div className="space-y-1 pt-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          価格
        </p>
        <p className="tracking-tight">
          <PriceTag
            priceJpy={item.priceJpy}
            discountPercent={item.discountPercent}
            discountStartsAt={item.discountStartsAt}
            discountEndsAt={item.discountEndsAt}
          />
        </p>
      </div>
    </div>
  );
}

/**
 * 現在の active index を中心にした連続 4 枚を返す。配列の末尾を超えたら
 * 先頭から循環する(Steam の挙動を踏襲、次に来る候補が「並び順」で見える)。
 */
function computeThumbnailItems(
  items: CarouselItem[],
  activeIndex: number,
): Array<{ item: CarouselItem; originalIndex: number }> {
  const total = items.length;
  const count = Math.min(THUMBNAIL_COUNT, total);
  const result: Array<{ item: CarouselItem; originalIndex: number }> = [];
  for (let i = 0; i < count; i++) {
    const idx = (activeIndex + i) % total;
    result.push({ item: items[idx], originalIndex: idx });
  }
  return result;
}

/**
 * 1 枚のスライド(大画面)。active のときだけ opacity 1。
 *
 * onClick で consumeWasSwiping() を呼んで、swipe ジェスチャ中の tap では
 * 詳細遷移しないようにする(モバイル UX、HHHHH)。
 */
function CarouselSlide({
  item,
  active,
  index,
  total,
  consumeWasSwiping,
}: {
  item: CarouselItem;
  active: boolean;
  index: number;
  total: number;
  consumeWasSwiping: () => boolean;
}) {
  return (
    <Link
      href={`/store/${item.slug}` as Route}
      onClick={(e) => {
        if (consumeWasSwiping()) {
          e.preventDefault();
        }
      }}
      className={cn(
        "absolute inset-0 block transition-opacity duration-700 ease-out",
        active ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!active}
      aria-label={`「${item.title}」の作品詳細を見る(${index + 1} / ${total})`}
    >
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

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-7">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="category">{categoryLabel(item.productType)}</Badge>
          <ReviewBadge summary={item.reviewSummary} size="sm" />
        </div>
        <h2 className="line-clamp-2 text-xl font-bold tracking-tight drop-shadow-md sm:text-2xl lg:text-3xl">
          {item.title}
        </h2>
        <p className="mt-1.5 tracking-tight">
          <PriceTag
            priceJpy={item.priceJpy}
            discountPercent={item.discountPercent}
            discountStartsAt={item.discountStartsAt}
            discountEndsAt={item.discountEndsAt}
            size="lg"
          />
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

/**
 * 右側サムネボタン(デスクトップ)。クリックで該当スライドへ切替。
 *
 * デザイン:
 *  - 横長の cover thumbnail + 右にタイトル(line-clamp-2)
 *  - active のときは accent ring + 全体明るく
 *  - non-active は opacity-70 で控えめ、hover で 100
 */
function ThumbnailButton({
  item,
  active,
  onClick,
}: {
  item: CarouselItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`「${item.title}」のサムネに切替`}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md border p-1.5 text-left transition-all",
        active
          ? "border-foreground/40 bg-background opacity-100 shadow-sm"
          : "border-transparent bg-background/50 opacity-70 hover:opacity-100",
      )}
    >
      <div className="h-10 w-16 shrink-0 overflow-hidden rounded-sm bg-muted">
        {item.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-4 w-4" aria-hidden />
          </div>
        )}
      </div>
      <span className="line-clamp-2 flex-1 text-[11px] font-medium leading-tight text-foreground/90">
        {item.title}
      </span>
    </button>
  );
}
