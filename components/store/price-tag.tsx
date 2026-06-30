import {
  formatPrice,
  salePriceJpy,
  effectiveDiscountPercent,
} from "@/lib/format/price";
import { cn } from "@/lib/utils";

/**
 * 価格表示(割引・セール期間対応)。Steam 風に「-XX% / 定価(取り消し線) / 割引後」。
 * 割引が効いていない(率0 or 期間外 or 無料)ときは普通の価格だけ出す。
 *
 * discountStartsAt/EndsAt は ISO or null。サーバ now とクライアント now の差は
 * 境界の数秒だけで実害なし(請求は checkout がサーバ now で再判定する)。
 */
export function PriceTag({
  priceJpy,
  discountPercent = 0,
  discountStartsAt = null,
  discountEndsAt = null,
  size = "md",
  className,
}: {
  priceJpy: number;
  discountPercent?: number;
  discountStartsAt?: string | null;
  discountEndsAt?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const eff = effectiveDiscountPercent(
    discountPercent,
    discountStartsAt,
    discountEndsAt,
  );
  const onSale = priceJpy > 0 && eff > 0;
  const now = formatPrice(onSale ? salePriceJpy(priceJpy, eff) : priceJpy);

  const nowSize =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base";

  if (!onSale) {
    return (
      <span className={cn("font-bold text-foreground", nowSize, className)}>
        {now}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-xs font-bold text-white">
        -{eff}%
      </span>
      <span className="text-xs text-muted-foreground line-through">
        {formatPrice(priceJpy)}
      </span>
      <span className={cn("font-bold text-emerald-600", nowSize)}>{now}</span>
    </span>
  );
}
