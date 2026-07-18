import Link from "next/link";
import type { Route } from "next";
import { DieFace, type DieFaceNumber } from "./die-face";
import { categoryLabel } from "@/lib/format/category";
import type { ProductType } from "@/lib/queries/types";

/**
 * 「カテゴリから探す — サイコロの目で選ぶ、6つの入り口」
 * (Re-dice Store.dc.html)。実カテゴリ(product_type)6 種にダイスの
 * 1〜6 の目を割り当て、公開作品の実カウントを添えるタイルグリッド。
 */
const ORDER: { type: ProductType; face: DieFaceNumber }[] = [
  { type: "full_package", face: 1 },
  { type: "scenario", face: 2 },
  { type: "rulebook", face: 3 },
  { type: "map", face: 4 },
  { type: "character_art", face: 5 },
  { type: "bgm_audio", face: 6 },
];

export function CategoryDice({
  counts,
}: {
  counts: Partial<Record<ProductType, number>>;
}) {
  return (
    <section id="categories" className="scroll-mt-24">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="die-ico" aria-hidden />
        <div>
          <h2 className="font-serif text-[19px] font-bold leading-tight">
            カテゴリから探す
          </h2>
          <p className="text-[11.5px] text-muted-foreground">
            サイコロの目で選ぶ、6つの入り口
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {ORDER.map(({ type, face }) => (
          <Link
            key={type}
            href={`/store?category=${type}` as Route}
            className="flex flex-col items-center gap-2 rounded-[14px] border border-[#E8DCC5] bg-white px-1.5 pb-3 pt-4 text-foreground shadow-[0_1px_2px_rgba(94,52,24,.06)] transition-all duration-200 hover:-translate-y-[3px] hover:border-[#B02832]/35 hover:shadow-[0_10px_30px_rgba(94,52,24,.10)]"
          >
            <DieFace
              face={face}
              size={42}
              color="#B02832"
              className="shadow-[0_2px_6px_rgba(176,40,50,.18)]"
              style={{ backgroundColor: "#fff" }}
            />
            <span className="flex min-w-0 max-w-full flex-col items-center gap-px">
              <span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] font-bold">
                {categoryLabel(type)}
              </span>
              <span className="text-[10.5px] text-muted-foreground">
                {(counts[type] ?? 0).toLocaleString("ja-JP")}作品
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
