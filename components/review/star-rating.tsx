"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 星評価の表示 / 入力コンポーネント。
 *
 * - 表示専用(`value` のみ): 平均星を 0.5 刻みで塗り分けて見せる。
 *   `value={4.3}` なら ★★★★☆(4 個塗り)+ 端数で半分。
 * - 入力(`onChange` あり): 1〜5 をクリック / ホバーで選択。キーボードは
 *   左右で増減できるよう radiogroup ロールを付与。
 *
 * Server Component からは「表示専用」で使える(onChange を渡さなければ
 * インタラクション無し)。サイズは sm/md/lg。
 */

type Size = "sm" | "md" | "lg";

const PX: Record<Size, number> = { sm: 14, md: 18, lg: 26 };

export function StarRating({
  value,
  onChange,
  size = "md",
  className,
  ariaLabel = "星評価",
}: {
  value: number;
  onChange?: (stars: number) => void;
  size?: Size;
  className?: string;
  ariaLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const interactive = typeof onChange === "function";
  const px = PX[size];
  // 入力時はホバー値を優先、表示時は value。
  const shown = interactive && hover !== null ? hover : value;

  return (
    <span
      className={cn("inline-flex items-center", className)}
      role={interactive ? "radiogroup" : "img"}
      aria-label={interactive ? ariaLabel : `${ariaLabel} ${value.toFixed(1)} / 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        // 表示専用は端数を半分塗りで表現。入力時は整数選択。
        const fill = interactive
          ? shown >= i
            ? 1
            : 0
          : Math.max(0, Math.min(1, shown - (i - 1)));
        const star = (
          <span
            className="relative inline-block"
            style={{ width: px, height: px }}
          >
            {/* 背景(空)*/}
            <Star
              className="absolute inset-0 text-amber-300/40"
              style={{ width: px, height: px }}
              strokeWidth={1.5}
              aria-hidden
            />
            {/* 前景(塗り)を fill 比率でクリップ */}
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star
                className="text-amber-400 fill-amber-400"
                style={{ width: px, height: px }}
                strokeWidth={1.5}
                aria-hidden
              />
            </span>
          </span>
        );

        if (!interactive) return <span key={i}>{star}</span>;

        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} つ星`}
            className="cursor-pointer p-0.5 transition-transform hover:scale-110"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            onClick={() => onChange!(i)}
          >
            {star}
          </button>
        );
      })}
    </span>
  );
}

/** 平均星 + 件数を「★ 4.3 (12)」の形で出す小型表示。 */
export function StarAverage({
  avg,
  total,
  size = "md",
  className,
}: {
  avg: number;
  total: number;
  size?: Size;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <StarRating value={avg} size={size} />
      <span className="font-semibold tabular-nums">{avg.toFixed(1)}</span>
      <span className="text-muted-foreground">({total})</span>
    </span>
  );
}
