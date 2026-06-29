import { Star } from "lucide-react";
import type { ProductReviewSummary } from "@/lib/queries/types";
import { cn } from "@/lib/utils";

/**
 * 商品カード / 詳細 hero に置く星評価 chip。
 *
 * 仕様:
 *  - summary が null / total = 0 のときは何も描画しない(冗長表示を避ける)
 *  - 平均星 ★ 4.3 (12) の形で表示。色は星(amber)で固定。
 *
 *  - size="sm" は商品カード用、size="md" は商品詳細 hero 用
 */
type Size = "sm" | "md";

interface ReviewBadgeProps {
  summary: ProductReviewSummary | null | undefined;
  size?: Size;
  className?: string;
}

const SIZE_CLASSES: Record<Size, { row: string; star: string; num: string }> = {
  sm: { row: "gap-0.5 text-[11px]", star: "h-3 w-3", num: "text-[11px]" },
  md: { row: "gap-1 text-xs", star: "h-3.5 w-3.5", num: "text-xs" },
};

export function ReviewBadge({
  summary,
  size = "sm",
  className,
}: ReviewBadgeProps) {
  if (!summary || summary.total === 0) return null;

  const sizes = SIZE_CLASSES[size];
  const avg = summary.avgStars ?? 0;

  return (
    <span
      className={cn("inline-flex items-center font-medium", sizes.row, className)}
      title={`平均 ${avg.toFixed(1)} / 5(${summary.total} 件)・${summary.label}`}
    >
      <Star
        className={cn("fill-amber-400 text-amber-400", sizes.star)}
        aria-hidden
      />
      <span className="font-semibold tabular-nums">{avg.toFixed(1)}</span>
      <span className={cn("text-muted-foreground", sizes.num)}>
        ({summary.total})
      </span>
    </span>
  );
}
