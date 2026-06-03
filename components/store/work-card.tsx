import Link from "next/link";
import { User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CoverImage } from "./cover-image";
import { ReviewBadge } from "@/components/review/review-badge";
import { categoryLabel } from "@/lib/format/category";
import { formatPrice } from "@/lib/format/price";
import { publicCoverUrl, publicAvatarUrl } from "@/lib/format/storage";
import type { ProductListItem } from "@/lib/queries/types";

interface WorkCardProps {
  product: ProductListItem;
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
export function WorkCard({ product }: WorkCardProps) {
  const coverUrl = publicCoverUrl(product.coverPath);
  const avatarUrl = publicAvatarUrl(product.creator.avatarPath);

  return (
    <Link
      href={`/store/${product.slug}`}
      className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`「${product.title}」の作品詳細を見る`}
    >
      <Card className="overflow-hidden border-border shadow-sm transition-all group-hover:border-foreground/20 group-hover:shadow-card">
        <div className="overflow-hidden">
          <CoverImage
            src={coverUrl}
            alt={product.title}
            className="transition-transform duration-300 group-hover:scale-[1.04]"
          />
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
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {product.systemLabel}
            </p>
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
  );
}
