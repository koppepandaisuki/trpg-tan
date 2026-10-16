import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * 実際の画面: GM の卓(ウィンドウ枠)+ 参加者のスマホ。暗い面(墨)の上に置く前提。
 * 画像は public/screens/(見本の卓を撮ったもの。撮り方は scripts/brand/README.md)。
 */
export function ProductShots({
  priority = false,
  className,
}: {
  /** ページの最初に見える位置なら true(先に読み込む)。 */
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={cn("relative pb-6 sm:pl-10", className)}>
      <div className="overflow-hidden rounded-xl bg-[#1c1c1c] shadow-2xl ring-1 ring-white/10">
        <div aria-hidden className="flex h-6 items-center gap-1.5 px-3">
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span className="h-2 w-2 rounded-full bg-white/20" />
        </div>
        <Image
          src="/screens/play-gm.png"
          alt="GM の卓の画面。盤面の上にキャラクターの駒、右にチャットとダイスの結果"
          width={800}
          height={500}
          priority={priority}
          sizes="(min-width: 1024px) 560px, 100vw"
          className="block h-auto w-full"
        />
      </div>
      <div className="absolute bottom-0 left-0 hidden w-[27%] overflow-hidden rounded-[22px] border-[5px] border-[#1d1d1d] bg-black shadow-2xl ring-1 ring-white/10 sm:block">
        <Image
          src="/screens/play-guest.png"
          alt="参加者のスマホの画面。盤面・チャット・タップで振れる判定"
          width={750}
          height={1624}
          sizes="180px"
          className="block aspect-[9/17] w-full object-cover object-top"
        />
      </div>
      <figcaption className="sr-only">Re-dice の卓の画面(PC の GM とスマホの参加者)</figcaption>
    </figure>
  );
}
