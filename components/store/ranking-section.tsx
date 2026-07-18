import Link from "next/link";
import type { Route } from "next";
import { Star } from "lucide-react";
import { Carousel } from "./carousel";
import { CoverImage } from "./cover-image";
import { categoryLabel } from "@/lib/format/category";
import { publicCoverUrl } from "@/lib/format/storage";
import { formatPrice } from "@/lib/format/price";
import type { ProductListItem } from "@/lib/queries/types";

/** 順位バッジ配色: 1=金 / 2=銀 / 3=琥珀 / 4位以降=白(Re-dice Store.dc.html)。 */
const RANK_STYLE: { bg: string; bd: string; fg: string }[] = [
  { bg: "#C9A227", bd: "#a8871a", fg: "#4a3a12" },
  { bg: "#e7e1d3", bd: "#d8d0bf", fg: "#6b6355" },
  { bg: "#e4b483", bd: "#d89a5f", fg: "#7a4a1f" },
];
const RANK_NEUTRAL = { bg: "#fff", bd: "#E8DCC5", fg: "#77644F" };

/**
 * 「人気ランキング」カルーセル(Re-dice Store.dc.html)。
 * 好評順トップ 6 を 2 枚/ビューの横送りで見せる。0 件(評価が誰も
 * 付いていない)なら呼び出し側で非表示にする想定。
 */
export function RankingSection({
  products,
  seeAllHref,
}: {
  /** 好評順で先頭6件(listTopRatedProducts の結果をそのまま渡す想定)。 */
  products: ProductListItem[];
  seeAllHref: Route;
}) {
  if (products.length === 0) return null;
  const items = products.slice(0, 6);

  return (
    <section id="ranking" className="scroll-mt-24">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="die-ico" aria-hidden />
        <div>
          <h2 className="font-serif text-[19px] font-bold leading-tight">
            人気ランキング
          </h2>
          <p className="text-[11.5px] text-muted-foreground">
            今週の好評トップ{items.length}
          </p>
        </div>
        <Link
          href={seeAllHref}
          className="ml-auto text-[12.5px] font-bold text-accent transition hover:text-primary"
        >
          もっと見る ›
        </Link>
      </div>

      <Carousel
        ariaLabel="人気ランキング"
        itemClassName="flex-[0_0_100%] sm:flex-[0_0_calc((100%-16px)/2)]"
      >
        {items.map((p, i) => {
          const rank = RANK_STYLE[i] ?? RANK_NEUTRAL;
          const coverUrl = publicCoverUrl(p.coverPath);
          return (
            <Link
              key={p.id}
              href={`/store/${p.slug}`}
              className="group flex h-full gap-3.5 rounded-2xl border border-[#E8DCC5] bg-white p-3.5 shadow-[0_1px_2px_rgba(94,52,24,.06)] transition-all duration-200 hover:-translate-y-[3px] hover:border-[#B02832]/30 hover:shadow-[0_10px_30px_rgba(94,52,24,.10)]"
              aria-label={`${i + 1}位「${p.title}」の作品詳細を見る`}
            >
              <span className="relative block w-[126px] shrink-0 self-center overflow-hidden rounded-lg">
                <CoverImage
                  src={coverUrl}
                  alt={p.title}
                  aspect="aspect-video"
                  className="transition-transform duration-300 group-hover:scale-105"
                />
                <span
                  className="absolute left-1.5 top-1.5 flex h-[26px] w-[26px] items-center justify-center rounded-full border font-serif text-[12.5px] font-extrabold shadow-[0_3px_9px_rgba(94,52,24,.25)]"
                  style={{
                    background: rank.bg,
                    borderColor: rank.bd,
                    color: rank.fg,
                  }}
                  aria-hidden
                >
                  {i + 1}
                </span>
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="self-start rounded-md bg-accent/[0.09] px-2 py-0.5 text-[10px] font-bold text-accent">
                  {categoryLabel(p.productType)}
                </span>
                <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold leading-[1.35]">
                  {p.title}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {p.creator.displayName}
                </span>
                <span className="mt-auto flex items-center gap-1.5 text-[11px]">
                  <Star className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden />
                  <b>{(p.reviewSummary?.avgStars ?? 0).toFixed(1)}</b>
                  <span className="text-muted-foreground">
                    ({p.reviewSummary?.total ?? 0})
                  </span>
                  <span className="ml-auto font-serif text-sm font-extrabold">
                    {formatPrice(p.priceJpy)}
                  </span>
                </span>
              </div>
            </Link>
          );
        })}
      </Carousel>
    </section>
  );
}
