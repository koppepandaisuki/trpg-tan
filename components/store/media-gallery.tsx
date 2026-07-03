"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Play,
  X,
  ZoomIn,
} from "lucide-react";
import { useSwipe } from "@/hooks/use-swipe";
import { cn } from "@/lib/utils";

/**
 * 商品詳細用のメディアギャラリー。Steam の overview gallery 相当。
 *
 * 構造:
 *  - 上: 中央の active 画像(16:10 aspect)
 *  - 下: thumbnail row(2 枚以上のときだけ表示)
 *
 * 操作:
 *  - サムネクリックで active 切替
 *  - 中央画像クリックで lightbox 拡大表示
 *  - lightbox 内:
 *    * Esc / backdrop / X ボタンで閉じる
 *    * 左右 chevron + ← → キーで前後の画像に切替
 *    * 画像下に「current / total」counter
 *  - body scroll lock + a11y(dialog / aria-current 等)
 *
 * ZoomableCover (ZZZZ) の進化版。XXXX で grid + ZoomableCover の組合せ
 * を使っていたが、Steam に倣って 1 つの統合 gallery にする。
 *
 * items が空のときは「画像なし」placeholder を出す。
 */

export interface MediaItem {
  src: string;
  alt: string;
}

/** ギャラリー項目が動画か(スクショ枠の mp4 / webm)。 */
function isVideoSrc(src: string): boolean {
  return /\.(mp4|webm)(\?|#|$)/i.test(src);
}

interface MediaGalleryProps {
  items: MediaItem[];
  /** Tailwind aspect、デフォルト 16:10 */
  aspect?: string;
  className?: string;
}

export function MediaGallery({
  items,
  aspect = "aspect-[16/10]",
  className,
}: MediaGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const total = items.length;

  const next = useCallback(() => {
    setActiveIndex((i) => (i + 1) % total);
  }, [total]);
  const prev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + total) % total);
  }, [total]);

  // モバイルスワイプ。メイン画像と lightbox で 1 つの hook を共有する
  // (どちらでも左/右で切替動作は同じ)。
  // 「左にスワイプ」→ 次の画像、「右にスワイプ」→ 前の画像、という
  // 直感的な対応にする(本のページ送りと同じ)。
  const swipe = useSwipe({
    onSwipeLeft: next,
    onSwipeRight: prev,
  });

  // Lightbox open 中のキーボード操作(Esc / 左右 矢印)
  useEffect(() => {
    if (!lightboxOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, prev, next]);

  // body scroll lock
  useEffect(() => {
    if (!lightboxOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [lightboxOpen]);

  // 画像なし時は placeholder
  if (total === 0) {
    return (
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-md bg-muted",
          aspect,
          className,
        )}
      >
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageIcon className="h-8 w-8" aria-hidden />
          <span className="sr-only">画像なし</span>
        </div>
      </div>
    );
  }

  const active = items[activeIndex];

  return (
    <div className={cn("space-y-2", className)}>
      {/* メイン active メディア。動画はその場で再生(lightbox は画像のみ)。 */}
      {isVideoSrc(active.src) ? (
        <div
          className={cn(
            "relative block w-full overflow-hidden rounded-md bg-black",
            aspect,
          )}
        >
          <video
            key={active.src}
            src={active.src}
            controls
            preload="metadata"
            className="h-full w-full object-contain"
          />
        </div>
      ) : (
      <button
        type="button"
        onClick={() => {
          // swipe 中の tap は無視(lightbox を開かない)
          if (swipe.consumeWasSwiping()) return;
          setLightboxOpen(true);
        }}
        onTouchStart={swipe.onTouchStart}
        onTouchMove={swipe.onTouchMove}
        onTouchEnd={swipe.onTouchEnd}
        aria-label={`「${active.alt}」を拡大表示(${activeIndex + 1} / ${total})`}
        className={cn(
          "group relative block w-full overflow-hidden rounded-md bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 touch-pan-y",
          aspect,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={active.src}
          alt={active.alt}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          loading={activeIndex === 0 ? "eager" : "lazy"}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100"
        >
          <ZoomIn className="h-3 w-3" aria-hidden />
          拡大
        </span>
        {/* 複数枚あるときは「N / total」を左下に出して認知補助 */}
        {total > 1 && (
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white"
          >
            {activeIndex + 1} / {total}
          </span>
        )}
      </button>
      )}

      {/* Thumbnail row(2 枚以上のときのみ) */}
      {total > 1 && (
        <ul
          className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6"
          aria-label="メディアサムネイル"
        >
          {items.map((it, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-pressed={i === activeIndex}
                aria-label={`${i + 1} 番目の${isVideoSrc(it.src) ? "動画" : "画像"}を選択`}
                className={cn(
                  "group relative block w-full overflow-hidden rounded-sm border-2 transition-all aspect-[16/10] bg-muted",
                  i === activeIndex
                    ? "border-foreground opacity-100"
                    : "border-transparent opacity-60 hover:opacity-100",
                )}
              >
                {isVideoSrc(it.src) ? (
                  <>
                    <video
                      src={it.src}
                      muted
                      preload="metadata"
                      className="pointer-events-none h-full w-full object-cover"
                    />
                    <Play
                      aria-hidden
                      className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow"
                    />
                  </>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={it.src}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="拡大プレビュー"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="閉じる(背景)"
            onClick={() => setLightboxOpen(false)}
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
          />

          {/* Close ボタン */}
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="拡大プレビューを閉じる"
            className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>

          {/* Prev / Next arrows(2 枚以上のとき)*/}
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label="前の画像"
                className="absolute left-4 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="次の画像"
                className="absolute right-4 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
              >
                <ChevronRight className="h-6 w-6" aria-hidden />
              </button>
            </>
          )}

          {/* 拡大画像(モバイルスワイプ対応)*/}
          <div
            className="relative z-10 flex max-h-[90vh] max-w-5xl flex-col items-center gap-3 touch-pan-y"
            onTouchStart={swipe.onTouchStart}
            onTouchMove={swipe.onTouchMove}
            onTouchEnd={swipe.onTouchEnd}
          >
            {isVideoSrc(active.src) ? (
              <video
                key={active.src}
                src={active.src}
                controls
                autoPlay
                className="max-h-[85vh] max-w-full rounded-md object-contain shadow-2xl"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={active.src}
                alt={active.alt}
                className="max-h-[85vh] max-w-full rounded-md object-contain shadow-2xl"
                draggable={false}
              />
            )}
            {total > 1 && (
              <span className="rounded bg-black/60 px-3 py-1 text-xs font-medium text-white">
                {activeIndex + 1} / {total}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
