import Link from "next/link";
import type { Route } from "next";
import { Carousel } from "./carousel";
import { CoverImage } from "./cover-image";
import { publicCoverUrl } from "@/lib/format/storage";
import {
  formatPrice,
  salePriceJpy,
  effectiveDiscountPercent,
} from "@/lib/format/price";
import type { ProductListItem } from "@/lib/queries/types";

/**
 * いちばん早く終わるセールの終了時刻から「残りN日 ・ M/D(曜) HH:MMまで」の
 * 緊急性チップを作る。終了日時つきのセールが 1 件もなければ null(チップ非表示)。
 */
function nearestEndLabel(products: ProductListItem[]): string | null {
  const now = Date.now();
  const ends = products
    .map((p) => (p.discountEndsAt ? Date.parse(p.discountEndsAt) : NaN))
    .filter((t) => Number.isFinite(t) && t > now);
  if (ends.length === 0) return null;
  const t = Math.min(...ends);
  const d = new Date(t);
  const days = Math.ceil((t - now) / 86_400_000);
  const remain = days <= 1 ? "残り1日未満" : `残り${days}日`;
  const week = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${remain} ・ ${d.getMonth() + 1}/${d.getDate()}(${week}) ${hh}:${mm}まで`;
}

/**
 * 「期間限定セール」帯(Re-dice Store.dc.html)。有効な割引がついた作品を
 * 3 枚/ビューのカルーセルで訴求し、終了期限チップで緊急性を出す。
 * 0 件なら呼び出し側で非表示にする想定。「セール一覧」は /store?sale=1
 * (本実装で追加したセール絞り込みビュー)へ。
 */
export function SaleStrip({ products }: { products: ProductListItem[] }) {
  if (products.length === 0) return null;
  const items = products.slice(0, 6);
  const maxOff = Math.max(
    ...items.map((p) =>
      effectiveDiscountPercent(
        p.discountPercent,
        p.discountStartsAt,
        p.discountEndsAt,
      ),
    ),
  );
  const endLabel = nearestEndLabel(items);

  return (
    <section id="sale" className="scroll-mt-24">
      <div className="overflow-hidden rounded-[18px] border border-[#EAD3B0] bg-gradient-to-r from-[#FFF8EF] to-white">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-[#F0E2C9] px-4 py-3 sm:px-[18px]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#B02832] px-3 py-[5px] text-xs font-bold text-white">
            🔥 期間限定セール
          </span>
          <span className="text-xs text-[#8a6a2a]">最大 {maxOff}% OFF</span>
          {endLabel && (
            <span className="rounded-full border border-[#EAD3B0] bg-white px-2.5 py-1 text-[11px] font-bold text-[#8a6a2a]">
              {endLabel}
            </span>
          )}
          <Link
            href={"/store?sale=1" as Route}
            className="ml-auto text-xs font-bold text-accent transition hover:text-primary"
          >
            セール一覧 →
          </Link>
        </div>
        <div className="px-4 pb-2 pt-3.5">
          <Carousel
            ariaLabel="セール中の作品"
            gap={12}
            edgeButtons={false}
            itemClassName="flex-[0_0_100%] sm:flex-[0_0_calc((100%-12px)/2)] lg:flex-[0_0_calc((100%-24px)/3)]"
          >
            {items.map((p) => {
              const eff = effectiveDiscountPercent(
                p.discountPercent,
                p.discountStartsAt,
                p.discountEndsAt,
              );
              const coverUrl = publicCoverUrl(p.coverPath);
              return (
                <Link
                  key={p.id}
                  href={`/store/${p.slug}`}
                  className="group flex h-full flex-col rounded-xl border border-[#F0E2C9] bg-white p-2.5"
                  aria-label={`「${p.title}」の作品詳細を見る(-${eff}%)`}
                >
                  <span className="relative mb-2 block overflow-hidden rounded-lg">
                    <CoverImage
                      src={coverUrl}
                      alt={p.title}
                      aspect="aspect-video"
                      className="transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className="absolute left-[7px] top-[7px] rounded-md bg-[#159457] px-[7px] py-0.5 text-[11px] font-extrabold text-white">
                      -{eff}%
                    </span>
                  </span>
                  <p className="mb-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-bold">
                    {p.title}
                  </p>
                  <span className="mt-auto flex items-center gap-[7px]">
                    <span className="text-[11px] text-muted-foreground line-through">
                      {formatPrice(p.priceJpy)}
                    </span>
                    <span className="font-serif text-[15px] font-extrabold text-[#159457]">
                      {formatPrice(salePriceJpy(p.priceJpy, eff))}
                    </span>
                  </span>
                </Link>
              );
            })}
          </Carousel>
        </div>
      </div>
    </section>
  );
}
