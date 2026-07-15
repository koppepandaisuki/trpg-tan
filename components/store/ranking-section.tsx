import Link from "next/link";
import type { Route } from "next";
import { Star } from "lucide-react";
import { CoverImage } from "./cover-image";
import { categoryLabel } from "@/lib/format/category";
import { publicCoverUrl } from "@/lib/format/storage";
import { formatPrice } from "@/lib/format/price";
import type { ProductListItem } from "@/lib/queries/types";
import { cn } from "@/lib/utils";

/** 1〜3位の順位バッジ配色(design_handoff_store_redesign 準拠: 金/銀/琥珀)。 */
const RANK_STYLE = [
  "border-[#C9A227] bg-[#C9A227] text-[#4a3a12]",
  "border-[#d8d0bf] bg-[#E7E1D3] text-[#6b6355]",
  "border-[#d89a5f] bg-[#E4B483] text-[#7a4a1f]",
];

/**
 * 「人気ランキング」セクション(design_handoff_store_redesign 案A)。
 * 好評順トップ3を横並びカードで見せる。順位バッジはカード左上に
 * -12px オフセットで重ねる。0 件(評価が誰も付いていない)なら
 * 呼び出し側で非表示にする想定。
 */
export function RankingSection({
  products,
  seeAllHref,
}: {
  /** 好評順で先頭3件(listTopRatedProducts の結果をそのまま渡す想定)。 */
  products: ProductListItem[];
  seeAllHref: Route;
}) {
  if (products.length === 0) return null;
  const top3 = products.slice(0, 3);

  return (
    <section className="mt-10">
      <div className="mb-5 flex items-center gap-3">
        <span className="die-ico" aria-hidden style={{ width: 26, height: 26 }} />
        <h2 className="font-serif text-xl font-bold sm:text-2xl">人気ランキング</h2>
        <span className="text-[12.5px] text-muted-foreground">今週の好評トップ3</span>
        <span className="h-px flex-1 self-center bg-gradient-to-r from-[#E4D9C2] to-transparent" />
        <Link
          href={seeAllHref}
          className="text-[12.5px] font-semibold text-accent transition hover:text-primary"
        >
          もっと見る →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {top3.map((p, i) => {
          const coverUrl = publicCoverUrl(p.coverPath);
          return (
            <Link
              key={p.id}
              href={`/store/${p.slug}`}
              className="cardhov-ranking group relative flex gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-[3px] hover:border-primary/35 hover:shadow-md"
              aria-label={`${i + 1}位「${p.title}」の作品詳細を見る`}
            >
              <span
                className={cn(
                  "absolute -left-3 -top-3 z-[2] flex h-[38px] w-[38px] items-center justify-center rounded-full border text-[17px] font-extrabold shadow-[0_4px_12px_rgba(94,52,24,.2)]",
                  RANK_STYLE[i],
                )}
                aria-hidden
              >
                {i + 1}
              </span>
              <div className="relative w-24 shrink-0 overflow-hidden rounded-[10px]">
                <CoverImage
                  src={coverUrl}
                  alt={p.title}
                  aspect="aspect-[3/4]"
                  className="transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="self-start rounded-md bg-accent/[0.09] px-2 py-0.5 text-[11px] font-semibold text-accent">
                  {categoryLabel(p.productType)}
                </span>
                <p className="line-clamp-2 text-[15px] font-semibold leading-snug">
                  {p.title}
                </p>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {p.creator.displayName}
                </p>
                <div className="mt-auto flex items-center gap-1.5 text-xs">
                  <Star className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden />
                  <b>{(p.reviewSummary?.avgStars ?? 0).toFixed(1)}</b>
                  <span className="text-muted-foreground">
                    ({p.reviewSummary?.total ?? 0})
                  </span>
                  <span className="ml-auto font-serif text-base font-bold">
                    {formatPrice(p.priceJpy)}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
