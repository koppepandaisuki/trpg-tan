import Link from "next/link";
import type { Route } from "next";
import { ChevronRight } from "lucide-react";
import { WorkCard } from "./work-card";
import type { ProductListItem } from "@/lib/queries/types";

/**
 * 横スクロール可能な商品 strip。Steam 系の「Top Sellers」「New Releases」を
 * 模した表現。CSS scroll-snap で軽量実装(専用ライブラリ依存なし)。
 *
 * - PC: マウスホイール / トラックパッドの水平スクロール
 * - モバイル: スワイプ
 * - 矢印アイコン無し(rev minimal)
 *
 * 空の時は何も描画しない(呼び出し側で判定)。
 */
export function ProductStrip({
  title,
  description,
  products,
  seeAllHref,
  ranked = false,
}: {
  title: string;
  description?: string;
  products: ProductListItem[];
  seeAllHref?: Route;
  /** true のとき各カードに順位バッジ(1 始まり)を表示する。*/
  ranked?: boolean;
}) {
  if (products.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
          >
            すべて見る
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>

      <div className="-mx-4 sm:-mx-6">
        <ul
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:px-6"
          style={{ scrollbarWidth: "thin" }}
        >
          {products.map((p, i) => (
            <li
              key={p.id}
              className="w-[180px] shrink-0 snap-start sm:w-[200px] lg:w-[220px]"
            >
              <WorkCard product={p} rank={ranked ? i + 1 : undefined} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
