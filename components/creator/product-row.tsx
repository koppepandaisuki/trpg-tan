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

/**
 * Creator の自作一覧用 row。
 *
 * 視覚改善(LibraryCard / WorkCard と統一の触感):
 *  - hover で border + shadow が変化、表紙が slight zoom
 *  - タイトルを text-base font-semibold で読みやすく
 *  - 表紙とタイトルが「編集ページへ」のリンクに(creator は編集が
 *    主アクションのため detail ではなく edit に飛ばす)
 *  - 編集ボタンは右端に維持(明示的なアクション)
 */
export function ProductRow({ product }: ProductRowProps) {
  const coverUrl = publicCoverUrl(product.coverPath);
  const editHref = `/creator/products/${product.id}/edit` as Route;

  return (
    <li className="group relative flex items-center gap-4 rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:border-foreground/20 hover:shadow-card">
      {/* 表紙(クリックで edit へ) */}
      <Link
        href={editHref}
        className="block w-24 shrink-0 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`「${product.title}」を編集`}
      >
        <CoverImage
          src={coverUrl}
          alt={product.title}
          aspect="aspect-[16/10]"
          className="transition-transform duration-300 group-hover:scale-[1.04]"
        />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusBadgeVariant(product.status)}>
            {statusLabel(product.status)}
          </Badge>
          <Badge variant="muted">{categoryLabel(product.productType)}</Badge>
        </div>

        {/* タイトル(クリックで edit へ) */}
        <Link
          href={editHref}
          className="mt-1 block truncate rounded-sm text-base font-semibold tracking-tight transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {product.title}
        </Link>

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
