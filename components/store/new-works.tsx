import Link from "next/link";
import type { Route } from "next";
import { Star } from "lucide-react";
import { Carousel } from "./carousel";
import { CoverImage } from "./cover-image";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { categoryLabel } from "@/lib/format/category";
import { publicCoverUrl } from "@/lib/format/storage";
import { formatPrice, isFree } from "@/lib/format/price";
import type { ProductListItem } from "@/lib/queries/types";

/**
 * 「新着作品」カルーセル(Re-dice Store.dc.html)。公開されたばかりの
 * 作品を 3 枚/ビュー(モバイル 1 / sm 2)で横送り。カバー右上のハートは
 * 既存のお気に入り(localStorage)トグルをそのまま使う。
 * 無料作品は緑の「無料配布」バッジ + 緑価格で目立たせる。
 */
export function NewWorks({ products }: { products: ProductListItem[] }) {
  if (products.length === 0) return null;
  const items = products.slice(0, 9);

  return (
    <section id="new" className="scroll-mt-24">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="die-ico" aria-hidden />
        <div>
          <h2 className="font-serif text-[19px] font-bold leading-tight">
            新着作品
          </h2>
          <p className="text-[11.5px] text-muted-foreground">
            公開されたばかりの作品
          </p>
        </div>
        <Link
          href={"/store?sort=published" as Route}
          className="ml-auto text-[12.5px] font-bold text-accent transition hover:text-primary"
        >
          すべて見る ›
        </Link>
      </div>

      <Carousel
        ariaLabel="新着作品"
        itemClassName="flex-[0_0_100%] sm:flex-[0_0_calc((100%-16px)/2)] lg:flex-[0_0_calc((100%-32px)/3)]"
      >
        {items.map((p) => {
          const coverUrl = publicCoverUrl(p.coverPath);
          const free = isFree(p.priceJpy);
          const favoriteItem = {
            slug: p.slug,
            title: p.title,
            coverUrl,
            productType: p.productType,
            priceJpy: p.priceJpy,
            systemLabel: p.systemLabel,
            creator: { id: p.creator.id, displayName: p.creator.displayName },
          };
          return (
            <div key={p.id} className="relative h-full">
              <Link
                href={`/store/${p.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#E8DCC5] bg-white shadow-[0_1px_2px_rgba(94,52,24,.06)] transition-all duration-200 hover:-translate-y-[3px] hover:border-[#B02832]/30 hover:shadow-[0_10px_30px_rgba(94,52,24,.10)]"
                aria-label={`「${p.title}」の作品詳細を見る`}
              >
                <div className="relative overflow-hidden">
                  <CoverImage
                    src={coverUrl}
                    alt={p.title}
                    aspect="aspect-video"
                    className="transition-transform duration-300 group-hover:scale-105"
                  />
                  {free && (
                    <span className="absolute left-2 top-2 rounded-md bg-[#e9f5ef] px-2 py-0.5 text-[10.5px] font-extrabold text-[#159457]">
                      無料配布
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 px-3 pb-3 pt-2.5">
                  <span className="text-[10px] font-bold text-accent">
                    {categoryLabel(p.productType)}
                    {p.systemLabel ? `・${p.systemLabel}` : ""}
                  </span>
                  <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold leading-[1.4]">
                    {p.title}
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    {p.creator.displayName}
                  </span>
                  <div className="mt-auto flex items-center justify-between gap-1.5 pt-0.5">
                    {p.reviewSummary && p.reviewSummary.total > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px]">
                        <Star
                          className="h-3 w-3 fill-gold text-gold"
                          aria-hidden
                        />
                        <b>{p.reviewSummary.avgStars.toFixed(1)}</b>
                        <span className="text-muted-foreground">
                          ({p.reviewSummary.total})
                        </span>
                      </span>
                    ) : (
                      <span />
                    )}
                    <span
                      className="font-serif text-sm font-extrabold"
                      style={free ? { color: "#159457" } : undefined}
                    >
                      {formatPrice(p.priceJpy)}
                    </span>
                  </div>
                </div>
              </Link>
              {/* お気に入り。Link の兄弟として右上に重ねる(nested anchor 回避)。 */}
              <div className="absolute right-2 top-2 z-10">
                <FavoriteButton item={favoriteItem} variant="compact" />
              </div>
            </div>
          );
        })}
      </Carousel>
    </section>
  );
}
