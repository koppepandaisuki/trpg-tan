import { Dices } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * パラDa-iCE のブランドロゴ。
 *
 * 元のロゴ画像(public/logo.png)を Vercel が拾えない問題への対応として、
 * 「画像ファイル不要・コードベースのロゴ」として実装。サイズや色を
 * Tailwind で完全に制御でき、ロード失敗が原理的に発生しない。
 *
 * 配色は元ロゴのトーンを Tailwind から近似:
 *  - 「パラ」  = rose-500   (coral / 暖色)
 *  - 「Da-iCE」 = sky-600    (寒色 / アクセント)
 *  - サイコロ  = sky-600    (Da-iCE と同色で視覚連動)
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
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

const TEXT_SIZE: Record<BrandMarkSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
};

const GAP: Record<BrandMarkSize, string> = {
  sm: "gap-1",
  md: "gap-1.5",
  lg: "gap-2",
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
      <Dices className={cn(ICON_SIZE[size], "text-sky-600")} aria-hidden />
      <span
        className={cn(
          "font-bold tracking-tight",
          TEXT_SIZE[size],
        )}
      >
        <span className="text-rose-500">パラ</span>
        <span className="text-sky-600">Da-iCE</span>
      </span>
      {showSubtitle && (
        <span className="ml-1 text-xs font-medium tracking-wide text-muted-foreground">
          TRPGサイト
        </span>
      )}
    </span>
  );
}
