"use client";

import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * ストアランディング共通の横スクロール・カルーセル(Re-dice Store.dc.html)。
 *
 *  - scroll-snap ベース(トラックパッド/スワイプでも自然に動く)
 *  - 左右の丸ボタンで 1 ビューポート分送り、下部ドットで直接ジャンプ
 *  - ページ数は scrollWidth / clientWidth から動的に計算(ブレークポイントで
 *    1 ビューあたりの枚数が変わっても正しく追従する)
 *
 * 子要素ごとの幅は itemClassName(flex-basis のユーティリティ)で指定する。
 * 例: "flex-[0_0_100%] sm:flex-[0_0_calc((100%-16px)/2)]"
 */
export function Carousel({
  children,
  itemClassName,
  gap = 16,
  ariaLabel,
  edgeButtons = true,
}: {
  children: ReactNode;
  /** 各アイテムに付ける flex-basis ユーティリティ。 */
  itemClassName: string;
  /** アイテム間の px(送り量の計算にも使う)。 */
  gap?: number;
  ariaLabel?: string;
  /** 左右ボタンをコンテナ外縁に少しはみ出させる(design 準拠)。 */
  edgeButtons?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const pages = Math.max(1, Math.round((el.scrollWidth + gap) / (el.clientWidth + gap)));
    setPageCount(pages);
    setPage((p) => Math.min(p, pages - 1));
  }, [gap]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const goTo = useCallback(
    (p: number) => {
      const el = trackRef.current;
      if (!el) return;
      const pp = Math.max(0, Math.min(pageCount - 1, p));
      el.scrollTo({ left: pp * (el.clientWidth + gap), behavior: "smooth" });
    },
    [gap, pageCount],
  );

  const livePage = useCallback(() => {
    const el = trackRef.current;
    if (!el) return page;
    return Math.max(
      0,
      Math.min(pageCount - 1, Math.round(el.scrollLeft / (el.clientWidth + gap))),
    );
  }, [gap, page, pageCount]);

  function onScroll() {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setPage(livePage()), 140);
  }

  const items = Children.toArray(children);
  const showNav = pageCount > 1;
  const btnBase =
    "absolute top-1/2 z-[5] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#E8DCC5] bg-white text-[17px] leading-none text-accent shadow-[0_4px_14px_rgba(94,52,24,.16)] transition-opacity";

  return (
    <div aria-label={ariaLabel}>
      <div className="relative">
        {showNav && (
          <button
            type="button"
            aria-label="前へ"
            onClick={() => goTo(livePage() - 1)}
            className={btnBase}
            style={{
              left: edgeButtons ? -16 : -4,
              opacity: page === 0 ? 0.35 : 1,
            }}
          >
            ‹
          </button>
        )}
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="-m-3.5 flex snap-x snap-proximity overflow-x-auto p-3.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ gap }}
        >
          {items.map((child, i) => (
            <div key={i} className={`min-w-0 snap-start ${itemClassName}`}>
              {child}
            </div>
          ))}
        </div>
        {showNav && (
          <button
            type="button"
            aria-label="次へ"
            onClick={() => goTo(livePage() + 1)}
            className={btnBase}
            style={{
              right: edgeButtons ? -16 : -4,
              opacity: page >= pageCount - 1 ? 0.35 : 1,
            }}
          >
            ›
          </button>
        )}
      </div>
      {showNav && (
        <div className="mt-3.5 flex justify-center gap-1.5">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}ページ目へ`}
              onClick={() => goTo(i)}
              className="h-1.5 rounded-full border-none p-0 transition-all"
              style={{
                width: i === page ? 22 : 8,
                background: i === page ? "#B02832" : "#E3D8C2",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
