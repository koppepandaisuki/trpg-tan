import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/store/cover-image";
import { DownloadButton } from "./download-button";
import { categoryLabel, fileFormatLabel } from "@/lib/format/category";
import { formatPrice } from "@/lib/format/price";
import { publicCoverUrl } from "@/lib/format/storage";
import type { LibraryItem } from "@/lib/queries/library";

interface LibraryCardProps {
  item: LibraryItem;
}

/**
 * Library row. Renders availability via a badge and a download button
 * gated on `item.availability`. The component never sees file_path.
 */
export function LibraryCard({ item }: LibraryCardProps) {
  const coverUrl = publicCoverUrl(item.coverPath);
  const detailHref: Route | null = item.slug ? (`/store/${item.slug}` as Route) : null;

  const downloadDisabled = item.availability !== "available";
  const label = item.fileFormat === "audio" ? "ダウンロード" : "ダウンロード";

  return (
    <li className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-stretch">
      <div className="w-full max-w-[180px] shrink-0 sm:w-44">
        <CoverImage src={coverUrl} alt={item.title} aspect="aspect-[16/10]" />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <AvailabilityBadge availability={item.availability} />
          <Badge variant="muted">{categoryLabel(item.productType)}</Badge>
          <Badge variant="muted">{fileFormatLabel(item.fileFormat)}</Badge>
        </div>

        <p className="text-sm font-medium leading-snug">
          {item.title}
        </p>

        <p className="text-xs text-muted-foreground">
          {item.creator.displayName && <>作者: {item.creator.displayName} · </>}
          購入日: {formatDate(item.paidAt)} · 購入時価格 {formatPrice(item.amountJpy)}
        </p>

        {detailHref && (
          <p className="text-xs">
            <Link
              href={detailHref}
              className="text-accent underline-offset-4 hover:underline"
            >
              作品詳細を見る
            </Link>
          </p>
        )}

        <AvailabilityHint availability={item.availability} />
      </div>

      <div className="flex flex-col items-end justify-center gap-2">
        <DownloadButton
          productId={item.productId}
          productTitle={item.title}
          disabled={downloadDisabled}
          label={label}
        />
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
