import Link from "next/link";
import type { Route } from "next";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CoverImage } from "@/components/store/cover-image";
import { categoryLabel } from "@/lib/format/category";
import { formatPrice } from "@/lib/format/price";
import { statusBadgeVariant, statusLabel } from "@/lib/format/status";
import { publicCoverUrl } from "@/lib/format/storage";
import type { MyProductListItem } from "@/lib/queries/creator-products";
import { cn } from "@/lib/utils";

interface ProductRowProps {
  product: MyProductListItem;
}

export function ProductRow({ product }: ProductRowProps) {
  const coverUrl = publicCoverUrl(product.coverPath);
  const editHref = `/creator/products/${product.id}/edit` as Route;

  return (
    <li className="flex items-center gap-4 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="w-24 shrink-0">
        <CoverImage src={coverUrl} alt={product.title} aspect="aspect-[16/10]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusBadgeVariant(product.status)}>
            {statusLabel(product.status)}
          </Badge>
          <Badge variant="muted">{categoryLabel(product.productType)}</Badge>
        </div>
        <p className="mt-1 truncate text-sm font-medium">{product.title}</p>
        <p className="text-xs text-muted-foreground">
          {formatPrice(product.priceJpy)} · 更新 {formatDate(product.updatedAt)}
        </p>
      </div>
      <Link
        href={editHref}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        aria-label={`「${product.title}」を編集`}
      >
        <Pencil className="h-4 w-4" />
        編集
      </Link>
    </li>
  );
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
