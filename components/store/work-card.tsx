import Link from "next/link";
import { User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CoverImage } from "./cover-image";
import { ReviewBadge } from "@/components/review/review-badge";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { categoryLabel } from "@/lib/format/category";
import { formatPrice } from "@/lib/format/price";
import { publicCoverUrl, publicAvatarUrl } from "@/lib/format/storage";
import type { ProductListItem } from "@/lib/queries/types";
import { cn } from "@/lib/utils";

interface WorkCardProps {
  product: ProductListItem;
  /** ランキング順位(1 始まり)。指定時はカバー左上に順位バッジを出す。*/
  rank?: number;
}

/** 順位バッジの配色。1=ゴールド/2=シルバー/3=ブロンズ、以降は淡い青。*/
function rankBadgeTone(rank: number): string {
  if (rank === 1) return "border-gold bg-gold text-[#5b4a12]";
  if (rank === 2) return "border-slate-300 bg-slate-100 text-slate-600";
  if (rank === 3) return "border-amber-300 bg-amber-100 text-amber-800";
  return "border-border bg-primary-soft text-accent";
}

/**
 * ストアの商品グリッドカード。
 *
 * 視覚改善(LibraryCard と統一の触感):
 *  - hover で border + shadow が変化、表紙が slight zoom
 *  - タイトルを text-base font-semibold で読みやすく
 *  - 価格を tracking-tight + slightly larger で視認性向上
 *  - CCCC: クリエイターアバター(小)を display name の左に表示。
 *    アバター未設定者は User icon プレースホルダ。視覚的に「人」を
 *    強調することで購入判断材料を増やす。
 */
export function WorkCard({ product, rank }: WorkCardProps) {
  const coverUrl = publicCoverUrl(product.coverPath);
  const avatarUrl = publicAvatarUrl(product.creator.avatarPath);

  // お気に入りトグル(localStorage)。カード全体が <Link> なので、ボタンを
  // Link の子(=<a> 内の <button>)にすると DOM 違反になる。relative ラッパー
  // 内で Link の「兄弟」として重ね、ボタンを上に置く(z-10)ことで回避する。
  const favoriteItem = {
    slug: product.slug,
    title: product.title,
    coverUrl,
    productType: product.productType,
    priceJpy: product.priceJpy,
    systemLabel: product.systemLabel,
    creator: {
      id: product.creator.id,
      displayName: product.creator.displayName,
    },
  };

  return (
    <div className="relative">
      <Link
        href={`/store/${product.slug}`}
        className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`「${product.title}」の作品詳細を見る`}
      >
        <Card className="overflow-hidden border-border shadow-card transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md">
          <div className="relative overflow-hidden">
            <CoverImage
              src={coverUrl}
              alt={product.title}
              className="transition-transform duration-300 group-hover:scale-[1.04]"
            />
            {rank != null && (
              <span
                className={cn(
                  "absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold shadow-sm",
                  rankBadgeTone(rank),
                )}
                aria-label={`ランキング ${rank} 位`}
              >
                {rank}
              </span>
            )}
          </div>
          <CardContent className="space-y-1.5 p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="category">{categoryLabel(product.productType)}</Badge>
              <ReviewBadge summary={product.reviewSummary} size="sm" />
            </div>
            <p className="line-clamp-2 text-base font-semibold leading-snug tracking-tight transition-colors group-hover:text-accent">
              {product.title}
            </p>
            {product.systemLabel && (
              <p className="line-clamp-1 text-xs text-muted-foreground">{product.systemLabel}</p>
            )}
            {/* クリエイター行(アバター + 名前)。WorkCard 全体が <Link> で
              囲われているため、ここを別 link にはできない(nested anchor
              回避)。アバター単体は装飾扱い。 */}
            {product.creator.displayName && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="h-4 w-4 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <User className="h-2.5 w-2.5" aria-hidden />
                    </div>
                  )}
                </div>
                <span className="line-clamp-1">{product.creator.displayName}</span>
              </div>
            )}
            <p className="pt-1 text-base font-semibold tracking-tight">
              {formatPrice(product.priceJpy)}
            </p>
          </CardContent>
        </Card>
      </Link>
      {/* お気に入り(localStorage)。Link の兄弟として右上に重ねる。 */}
      <div className="absolute right-2 top-2 z-10">
        <FavoriteButton item={favoriteItem} variant="compact" />
      </div>
    </div>
  );
}
