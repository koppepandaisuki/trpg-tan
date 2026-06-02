import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CoverImage } from "./cover-image";
import { categoryLabel } from "@/lib/format/category";
import { formatPrice } from "@/lib/format/price";
import { publicCoverUrl } from "@/lib/format/storage";
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
 */
export function WorkCard({ product }: WorkCardProps) {
  const coverUrl = publicCoverUrl(product.coverPath);

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
          <Badge variant="category">{categoryLabel(product.productType)}</Badge>
          <p className="line-clamp-2 text-base font-semibold leading-snug tracking-tight transition-colors group-hover:text-accent">
            {product.title}
          </p>
          {product.systemLabel && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {product.systemLabel}
            </p>
          )}
          {product.creator.displayName && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {product.creator.displayName}
            </p>
          )}
          <p className="pt-1 text-base font-semibold tracking-tight">
            {formatPrice(product.priceJpy)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
