import Link from "next/link";
import type { Route } from "next";
import { User } from "lucide-react";
import { Carousel } from "./carousel";
import { CoverImage } from "./cover-image";
import { publicCoverUrl, publicAvatarUrl } from "@/lib/format/storage";
import type { TopCreatorEntry } from "@/lib/queries/top-creators";

/**
 * 「人気クリエイター」カルーセル(Re-dice Store.dc.html)。
 * 実購入数の上位クリエイター(getTopCreators)を 2 枚/ビューで並べる。
 * カードは「そのクリエイター名でのストア検索」(検索は作者名にも
 * マッチする)へ、見出しの一覧リンクは /creators へ。
 * 0 件(実購入なし)なら呼び出し側で非表示。
 */
export function CreatorsSection({ entries }: { entries: TopCreatorEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section id="creators" className="scroll-mt-24">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="die-ico" aria-hidden />
        <div>
          <h2 className="font-serif text-[19px] font-bold leading-tight">
            人気クリエイター
          </h2>
          <p className="text-[11.5px] text-muted-foreground">
            よく購入されている作り手
          </p>
        </div>
        <Link
          href={"/creators" as Route}
          className="ml-auto text-[12.5px] font-bold text-accent transition hover:text-primary"
        >
          クリエイター一覧 ›
        </Link>
      </div>

      <Carousel
        ariaLabel="人気クリエイター"
        itemClassName="flex-[0_0_100%] sm:flex-[0_0_calc((100%-16px)/2)]"
      >
        {entries.map((e) => {
          const name = e.creator.displayName || "(無名)";
          const avatarUrl = publicAvatarUrl(e.creator.avatarPath);
          const bestCover = publicCoverUrl(e.topProduct.coverPath);
          return (
            <Link
              key={e.creator.id}
              href={`/store?q=${encodeURIComponent(name)}` as Route}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#E8DCC5] bg-white shadow-[0_1px_2px_rgba(94,52,24,.06)] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_10px_30px_rgba(94,52,24,.10)]"
              aria-label={`${name} の作品を見る`}
            >
              <div className="flex items-center gap-3 border-b border-[#E8DCC5] px-4 py-3.5">
                <span className="relative block shrink-0">
                  <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#e4b483] to-[#8a1d26] font-serif text-[17px] font-bold text-white">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : name !== "(無名)" ? (
                      name.slice(0, 1)
                    ) : (
                      <User className="h-5 w-5" aria-hidden />
                    )}
                  </span>
                  <span className="absolute -bottom-1 -right-1 flex h-[19px] w-[19px] items-center justify-center rounded-full border-2 border-white bg-gold text-[10px] font-extrabold text-[#4a3a12]">
                    {e.rank}
                  </span>
                </span>
                <span className="flex min-w-0 flex-col gap-px">
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-bold">
                    {name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    累計購入 {e.totalSales.toLocaleString("ja-JP")} 件
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2.5 px-4 py-3">
                <span className="block w-[72px] shrink-0 overflow-hidden rounded-md">
                  <CoverImage
                    src={bestCover}
                    alt={e.topProduct.title}
                    aspect="aspect-video"
                  />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[9.5px] text-muted-foreground">
                    ベストセラー作品
                  </span>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold leading-[1.35]">
                    {e.topProduct.title}
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
