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

export function WorkCard({ product }: WorkCardProps) {
  const coverUrl = publicCoverUrl(product.coverPath);

  return (
    <Link
      href={`/store/${product.slug}`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
    >
      <Card className="overflow-hidden shadow-sm transition-shadow group-hover:shadow-card">
        <CoverImage src={coverUrl} alt={product.title} />
        <CardContent className="space-y-1.5 p-4">
          <Badge variant="category">{categoryLabel(product.productType)}</Badge>
          <p className="line-clamp-2 text-sm font-medium leading-snug">{product.title}</p>
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
          <p className="pt-1 text-sm font-semibold">{formatPrice(product.priceJpy)}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
