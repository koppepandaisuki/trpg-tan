import { cn } from "@/lib/utils";

/**
 * Re-dice のブランドロゴ(2026-07 リブランド)。
 * タイトルロゴ画像(public/brand/re-dice.png: 黒文字 + 赤ダイス + "dicere")を
 * そのまま表示する。サイトはライト専用のため画像は 1 種。
 *
 * 使い方:
 *   <BrandMark size="md" />           // ヘッダー / フッター標準
 *   <BrandMark size="sm" />           // モバイル / コンパクト場面
 *   <BrandMark size="lg" />           // hero / splash
 *
 * Server Component(状態を持たない)。
 */
type BrandMarkSize = "sm" | "md" | "lg";

interface BrandMarkProps {
  size?: BrandMarkSize;
  /**
   * `true` で「TRPGサイト」サブタイトルを追加表示する。fully expanded
   * 表記が欲しい場合(landing hero など)に。デフォルトは false。
   */
  showSubtitle?: boolean;
  className?: string;
}

const LOGO_SIZE: Record<BrandMarkSize, string> = {
  sm: "h-7",
  md: "h-9",
  lg: "h-14",
};

export function BrandMark({
  size = "md",
  showSubtitle = false,
  className,
}: BrandMarkProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 leading-none", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/re-dice.png"
        alt="Re-dice"
        className={cn(
          LOGO_SIZE[size],
          "w-auto shrink-0 object-contain drop-shadow-[0_2px_5px_rgba(153,27,27,0.15)]",
        )}
      />
      {showSubtitle && (
        <span className="ml-1 text-xs font-medium tracking-wide text-muted-foreground">
          TRPGサイト
        </span>
      )}
    </span>
  );
}
