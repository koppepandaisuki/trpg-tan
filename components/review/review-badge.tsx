import { ThumbsUp } from "lucide-react";
import type { ProductReviewSummary } from "@/lib/queries/types";
import { cn } from "@/lib/utils";

/**
 * 商品カード / 詳細 hero に置く Steam 風の総合評価 chip。
 *
 * 仕様:
 *  - summary が null / total = 0 のときは何も描画しない(冗長表示を避ける)
 *  - 「評価不足」(<5件) も控えめに表示(label を muted 系で)
 *  - 5 件以上で色付きラベル(reviews / review-section と同じ tone)
 *
 * 表示形式:
 *  [👍 88%]  非常に好評  (12)
 *
 *  - size="sm" は商品カード用、size="md" は商品詳細 hero 用
 */
type Size = "sm" | "md";

interface ReviewBadgeProps {
  summary: ProductReviewSummary | null | undefined;
  size?: Size;
  className?: string;
}

const TONES: Record<string, string> = {
  圧倒的に好評: "border-emerald-300 bg-emerald-100 text-emerald-900",
  非常に好評: "border-emerald-300 bg-emerald-50 text-emerald-800",
  ほぼ好評: "border-sky-300 bg-sky-50 text-sky-800",
  賛否両論: "border-amber-300 bg-amber-50 text-amber-900",
  やや不評: "border-orange-300 bg-orange-50 text-orange-900",
  不評: "border-rose-300 bg-rose-50 text-rose-900",
  圧倒的に不評: "border-rose-400 bg-rose-100 text-rose-950",
  評価不足: "border-slate-200 bg-slate-50 text-slate-600",
  評価なし: "border-slate-200 bg-slate-50 text-slate-600",
};

const SIZE_CLASSES: Record<Size, { row: string; chip: string; count: string }> = {
  sm: {
    row: "gap-1 text-[10px]",
    chip: "px-1.5 py-0.5",
    count: "text-[10px]",
  },
  md: {
    row: "gap-1.5 text-xs",
    chip: "px-2 py-0.5",
    count: "text-xs",
  },
};

export function ReviewBadge({
  summary,
  size = "sm",
  className,
}: ReviewBadgeProps) {
  if (!summary || summary.total === 0) return null;

  const tone = TONES[summary.label] ?? TONES["評価なし"];
  const sizes = SIZE_CLASSES[size];
  const ratio =
    summary.total > 0 ? Math.round((summary.positive / summary.total) * 100) : 0;

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium",
        sizes.row,
        className,
      )}
      title={`高評価 ${summary.positive} / 全 ${summary.total} 件(${ratio}%)`}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border",
          sizes.chip,
          tone,
        )}
      >
        <ThumbsUp className="h-3 w-3" aria-hidden />
        <span>{summary.label}</span>
      </span>
      <span className={cn("text-muted-foreground", sizes.count)}>
        ({summary.total})
      </span>
    </span>
  );
}
