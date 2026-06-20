import Link from "next/link";
import type { Route } from "next";
import { Star, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/store/cover-image";
import { DownloadButton } from "./download-button";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { categoryLabel, fileFormatLabel } from "@/lib/format/category";
import { formatPrice } from "@/lib/format/price";
import type { LibraryItem } from "@/lib/queries/library";
import { cn } from "@/lib/utils";

interface LibraryCardProps {
  item: LibraryItem;
}

/**
 * Library row. Renders availability via a badge and a download button
 * gated on `item.availability`. The component never sees file_path.
 *
 * 視覚改善:
 *  - 表紙画像をクリック可能(detail ページへ)
 *  - hover で border + shadow + 表紙 scale で「触れる」感を強調
 *  - タイトルを text-base font-semibold で読みやすく
 *  - 利用不可状態のカードは opacity を落として disabled 感を出す
 *  - タイトル自体も detail へのリンクに(冗長な「作品詳細を見る」削除)
 */
export function LibraryCard({ item }: LibraryCardProps) {
  const coverUrl = item.coverUrl;
  const detailHref: Route | null = item.slug
    ? (`/store/${item.slug}` as Route)
    : null;

  const downloadDisabled = item.availability !== "available";
  const isUnavailable =
    item.availability === "suspended" || item.availability === "blocked";

  // レビュー導線は「詳細ページに飛べる(=公開中) かつ 購入済み」のときだけ。
  // 配布停止/利用不可(詳細ページが notFound になる)では出さない。
  const canReview =
    !!item.slug &&
    (item.availability === "available" || item.availability === "no_file");
  const reviewHref: Route | null = canReview
    ? (`/store/${item.slug}#reviews` as Route)
    : null;

  // お気に入り(localStorage)用の最小データ。ライブラリ品は購入時価格しか
  // 持たないため priceJpy は amountJpy で代用、systemLabel は持たないので null。
  const favoriteItem = {
    slug: item.slug,
    title: item.title,
    coverUrl: item.coverUrl,
    productType: item.productType,
    priceJpy: item.amountJpy,
    systemLabel: null,
    creator: { id: item.creator.id, displayName: item.creator.displayName },
  };

  return (
    <li
      className={cn(
        "group relative flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm transition-all",
        "hover:border-foreground/20 hover:shadow-card",
        "sm:flex-row sm:items-stretch",
        isUnavailable && "opacity-75",
      )}
    >
      {/* 表紙(クリック可能、無ければただの画像) */}
      <div className="relative w-full max-w-[180px] shrink-0 sm:w-44">
        {detailHref ? (
          <Link
            href={detailHref}
            className="block overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`「${item.title}」の作品詳細を見る`}
          >
            <CoverImage
              src={coverUrl}
              alt={item.title}
              aspect="aspect-[16/10]"
              className="transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </Link>
        ) : (
          <CoverImage
            src={coverUrl}
            alt={item.title}
            aspect="aspect-[16/10]"
          />
        )}
        {/* お気に入り(localStorage)。詳細に飛べる(=slug あり)ものだけ。 */}
        {item.slug && (
          <div className="absolute right-1.5 top-1.5 z-10">
            <FavoriteButton
              item={favoriteItem}
              variant="compact"
              className="h-8 w-8"
            />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <AvailabilityBadge availability={item.availability} />
          <Badge variant="muted">{categoryLabel(item.productType)}</Badge>
          <Badge variant="muted">{fileFormatLabel(item.fileFormat)}</Badge>
        </div>

        {/* タイトル(detail へのリンク化) */}
        {detailHref ? (
          <Link
            href={detailHref}
            className="block rounded-sm text-base font-semibold leading-snug tracking-tight transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {item.title}
          </Link>
        ) : (
          <p className="text-base font-semibold leading-snug tracking-tight">
            {item.title}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {item.creator.displayName && <>作者: {item.creator.displayName} · </>}
          購入日: {formatDate(item.paidAt)} · 購入時価格{" "}
          {formatPrice(item.amountJpy)}
        </p>

        <AvailabilityHint availability={item.availability} />
      </div>

      <div className="flex flex-col items-stretch justify-center gap-2 sm:items-end">
        <DownloadButton
          productId={item.productId}
          productTitle={item.title}
          disabled={downloadDisabled}
          label="ダウンロード"
        />
        {reviewHref && (
          <Link
            href={reviewHref}
            className={cn(
              "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium transition",
              item.reviewed
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100"
                : "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100",
            )}
            aria-label={
              item.reviewed
                ? `「${item.title}」のレビューを編集する`
                : `「${item.title}」のレビューを書く`
            }
          >
            {item.reviewed ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                レビュー済み・編集
              </>
            ) : (
              <>
                <Star className="h-3.5 w-3.5" aria-hidden />
                レビューを書く
              </>
            )}
          </Link>
        )}
      </div>
    </li>
  );
}

function AvailabilityBadge({
  availability,
}: {
  availability: LibraryItem["availability"];
}) {
  switch (availability) {
    case "available":
      return <Badge variant="category">利用可能</Badge>;
    case "no_file":
      return <Badge variant="muted">準備中</Badge>;
    case "suspended":
      return <Badge variant="default">配布停止中</Badge>;
    case "blocked":
    default:
      return <Badge variant="muted">利用不可</Badge>;
  }
}

function AvailabilityHint({
  availability,
}: {
  availability: LibraryItem["availability"];
}) {
  if (availability === "available") return null;
  const text =
    availability === "no_file"
      ? "作者がファイルを登録するとダウンロードできるようになります。"
      : availability === "suspended"
        ? "運営により配布が一時停止されています。再開され次第ダウンロードできます。"
        : "現在この作品はダウンロードできません。";
  return <p className="text-xs text-muted-foreground">{text}</p>;
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
