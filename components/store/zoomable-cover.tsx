"use client";

import { useEffect, useState } from "react";
import { ImageIcon, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 商品詳細用のクリック可能なカバー画像。クリックで「ライトボックス
 * (拡大プレビュー)」を開く。
 *
 * 視覚:
 *  - 通常時: CoverImage と同じ aspect-[16/10] のカバー表示
 *  - hover で右下に ZoomIn icon の半透明 chip が浮かぶ(クリック誘導)
 *  - 画像が無い時は ImageIcon の placeholder(ライトボックス非表示)
 *
 * ライトボックス:
 *  - 全画面 fixed overlay、半透明 backdrop
 *  - 中央に拡大画像(max-w-5xl / max-h-[90vh])
 *  - 右上に X 閉じるボタン
 *  - Escape / backdrop クリックで閉じる
 *  - body scroll lock(WelcomeTour / MobileMenu と同じ実装パターン)
 *
 * Server Component が CoverImage を使っている場所はそのまま、商品詳細
 * のメインカバーだけ ZoomableCover に置き換える(他の場所では拡大不要)。
 */
interface ZoomableCoverProps {
  src: string | null;
  alt: string;
  className?: string;
  /** Tailwind aspect class、デフォルト 16:10 */
  aspect?: string;
}

export function ZoomableCover({
  src,
  alt,
  className,
  aspect = "aspect-[16/10]",
}: ZoomableCoverProps) {
  const [open, setOpen] = useState(false);

  // Escape で閉じる
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // 画像なし → placeholder のみ、クリック不可
  if (!src) {
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
          <span className="sr-only">表紙画像なし</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`「${alt}」を拡大表示`}
        className={cn(
          "group relative block w-full overflow-hidden rounded-md bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          aspect,
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
        />
        {/* ZoomIn hint chip(hover で出現) */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100"
        >
          <ZoomIn className="h-3 w-3" aria-hidden />
          拡大
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="拡大プレビュー"
        >
          {/* Backdrop(button 化で Tab + Enter 操作可) */}
          <button
            type="button"
            aria-label="閉じる(背景)"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Close ボタン(右上)*/}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="拡大プレビューを閉じる"
            className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>

          {/* 拡大画像 */}
          <div className="relative z-10 max-h-[90vh] max-w-5xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[90vh] max-w-full rounded-md object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
}
