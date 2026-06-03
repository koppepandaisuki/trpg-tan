import Link from "next/link";
import type { Route } from "next";
import { Trophy, ChevronRight, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/store/cover-image";
import { publicAvatarUrl, publicCoverUrl } from "@/lib/format/storage";
import { formatPrice } from "@/lib/format/price";
import { categoryLabel } from "@/lib/format/category";
import type { TopCreatorEntry } from "@/lib/queries/top-creators";
import { cn } from "@/lib/utils";

/**
 * ストアフロントの「人気クリエイター TOP 3」セクション。
 *
 * 各カードは:
 *  - rank バッジ(1 位 = gold / 2 位 = silver / 3 位 = bronze)
 *  - 大きめのアバター + 名前 + 公開作品数 / 売上数
 *  - その creator のベストセラー作品(cover + title + price)
 *  - card 全体クリックで /creator/[id] へ
 *
 * 空配列のときは何も描画しない(α 期間で実購入ゼロの初期状態)。
 * 「4 位以下は /creators から」の seeAllHref で完全リストへ誘導する。
 *
 * Server Component(状態なし)。
 */
export function TopCreatorsSection({ entries }: { entries: TopCreatorEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700">
            <Trophy className="h-4 w-4" aria-hidden />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-lg font-semibold tracking-tight">
              人気クリエイター
            </h2>
            <p className="text-xs text-muted-foreground">
              購入数の多いクリエイター TOP {entries.length}
            </p>
          </div>
        </div>

        <Link
          href={"/creators" as Route}
          className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          すべて見る
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {entries.map((e) => (
          <li key={e.creator.id}>
            <TopCreatorCard entry={e} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const RANK_TONES: Record<number, { ring: string; badgeBg: string; badgeText: string; gradient: string }> = {
  1: {
    ring: "ring-2 ring-amber-300",
    badgeBg: "bg-amber-100 border-amber-300",
    badgeText: "text-amber-800",
    gradient: "from-amber-500/12 via-transparent to-amber-500/5",
  },
  2: {
    ring: "ring-2 ring-slate-300",
    badgeBg: "bg-slate-100 border-slate-300",
    badgeText: "text-slate-800",
    gradient: "from-slate-500/10 via-transparent to-slate-500/5",
  },
  3: {
    ring: "ring-2 ring-orange-300",
    badgeBg: "bg-orange-100 border-orange-300",
    badgeText: "text-orange-800",
    gradient: "from-orange-500/12 via-transparent to-orange-500/5",
  },
};

function TopCreatorCard({ entry }: { entry: TopCreatorEntry }) {
  const { creator, topProduct, totalSales, rank } = entry;
  const avatarUrl = publicAvatarUrl(creator.avatarPath);
  const coverUrl = publicCoverUrl(topProduct.coverPath);
  const name = creator.displayName || "(名称未設定)";
  const tone = RANK_TONES[rank] ?? RANK_TONES[3];

  return (
    <Link
      href={`/creator/${creator.id}` as Route}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
      aria-label={`${name} のプロフィールを見る(${rank} 位)`}
    >
      <Card
        className={cn(
          "h-full overflow-hidden border-border bg-gradient-to-br shadow-sm transition-all group-hover:border-foreground/20 group-hover:shadow-card",
          tone.gradient,
        )}
      >
        <CardContent className="space-y-3 py-4">
          {/* Header: rank + avatar + 名前 + 売上 */}
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted",
                tone.ring,
              )}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <User className="h-6 w-6" aria-hidden />
                </div>
              )}
              {/* rank バッジ(アバター右下) */}
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold",
                  tone.badgeBg,
                  tone.badgeText,
                )}
                aria-hidden
              >
                {rank}
              </span>
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate text-base font-semibold tracking-tight transition-colors group-hover:text-accent">
                {name}
              </p>
              <p className="text-[11px] text-muted-foreground">
                累計購入 {totalSales} 件
              </p>
            </div>
          </div>

          {/* Best product preview */}
          <div className="rounded-md border border-border bg-card/80 p-2.5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              ベストセラー作品
            </p>
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-16 shrink-0 overflow-hidden rounded-sm">
                <CoverImage
                  src={coverUrl}
                  alt={topProduct.title}
                  aspect="aspect-[16/10]"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="line-clamp-1 text-xs font-medium">
                  {topProduct.title}
                </p>
                <div className="flex items-center gap-1.5">
                  <Badge variant="category" className="text-[9px]">
                    {categoryLabel(topProduct.productType)}
                  </Badge>
                  <span className="text-[10px] font-semibold tracking-tight">
                    {formatPrice(topProduct.priceJpy)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
