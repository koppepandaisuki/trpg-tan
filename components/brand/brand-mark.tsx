import { cn } from "@/lib/utils";

/**
 * Re-dice のブランドロゴ。デスクトップアプリと同じ見た目に揃える:
 *  - アイコン = サイコロ画像(public/dice.png、背景透過)
 *  - 「Re-」 = 通常の文字色(foreground)
 *  - 「dice」= スカイ→シアンのグラデ文字(dice / dicere の掛けことば)
 *  - ウェイトは black(900)で、文字は画像でなくテキストなので滲まない
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

const ICON_SIZE: Record<BrandMarkSize, string> = {
  sm: "h-6 w-6",
  md: "h-7 w-7",
  lg: "h-9 w-9",
};

const TEXT_SIZE: Record<BrandMarkSize, string> = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
};

const GAP: Record<BrandMarkSize, string> = {
  sm: "gap-1.5",
  md: "gap-2",
  lg: "gap-2.5",
};

export function BrandMark({
  size = "md",
  showSubtitle = false,
  className,
}: BrandMarkProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center leading-none",
        GAP[size],
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/dice.png"
        alt=""
        aria-hidden
        className={cn(
          ICON_SIZE[size],
          "shrink-0 object-contain drop-shadow-[0_2px_5px_rgba(33,152,214,0.3)]",
        )}
      />
      <span className={cn("font-black tracking-tight", TEXT_SIZE[size])}>
        <span className="text-foreground">Re-</span>
        <span className="bg-gradient-to-r from-sky-600 to-cyan-400 bg-clip-text text-transparent">
          dice
        </span>
      </span>
      {showSubtitle && (
        <span className="ml-1 text-xs font-medium tracking-wide text-muted-foreground">
          TRPGサイト
        </span>
      )}
    </span>
  );
}
