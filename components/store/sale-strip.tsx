import Link from "next/link";
import type { Route } from "next";
import { CoverImage } from "./cover-image";
import { publicCoverUrl } from "@/lib/format/storage";
import {
  formatPrice,
  salePriceJpy,
  effectiveDiscountPercent,
} from "@/lib/format/price";
import type { ProductListItem } from "@/lib/queries/types";

/**
 * 「セール特集帯」(design_handoff_store_redesign 案A)。有効な割引がついた
 * 作品をまとめて訴求する。0 件なら呼び出し側で非表示にする想定。
 *
 * ※「セール一覧」専用の絞り込みビュー(?sale=1 等)は現状 store 側に
 * 無いため、导線は一旦 `/store?sort=rating` 相当の一覧に留める
 * (将来、専用フィルタを追加したらここだけ差し替える)。
 */
export function SaleStrip({ products }: { products: ProductListItem[] }) {
  if (products.length === 0) return null;
  const items = products.slice(0, 4);

  return (
    <section className="mt-10 overflow-hidden rounded-2xl border border-[#EAD3B0] bg-gradient-to-br from-[#fff8ef] to-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#F0E2C9] px-5 py-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-bold text-primary-foreground">
          🔥 期間限定セール
        </span>
        <span className="text-[13px] text-[#8a6a2a]">
          対象作品が最大{Math.max(...items.map((p) => effectiveDiscountPercent(p.discountPercent, p.discountStartsAt, p.discountEndsAt)))}
          %OFF
        </span>
        <Link
          href={("/store?sort=rating") as Route}
          className="ml-auto text-[12.5px] font-semibold text-accent transition hover:text-primary"
        >
          セール一覧 →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {items.map((p, i) => {
          const coverUrl = publicCoverUrl(p.coverPath);
          const eff = effectiveDiscountPercent(
            p.discountPercent,
            p.discountStartsAt,
            p.discountEndsAt,
          );
          const sale = salePriceJpy(p.priceJpy, eff);
          return (
            <Link
              key={p.id}
              href={`/store/${p.slug}`}
              className={`group flex flex-col p-4 transition hover:bg-white/60 ${
                i < items.length - 1 ? "sm:border-r sm:border-[#F0E2C9]" : ""
              }`}
              aria-label={`「${p.title}」の作品詳細を見る(-${eff}%)`}
            >
              <div className="relative mb-3 aspect-[16/10] overflow-hidden rounded-[10px]">
                <CoverImage
                  src={coverUrl}
                  alt={p.title}
                  className="transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute left-2 top-2 rounded-md bg-[#159457] px-2 py-0.5 text-xs font-extrabold text-white">
                  -{eff}%
                </span>
              </div>
              <p className="mb-1.5 line-clamp-1 text-sm font-semibold leading-snug">
                {p.title}
              </p>
              <div className="mt-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(p.priceJpy)}
                </span>
                <span className="font-serif text-lg font-bold text-[#159457]">
                  {formatPrice(sale)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
