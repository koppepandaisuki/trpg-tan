import type { CSSProperties } from "react";

/**
 * CSS だけで描くサイコロの面(1〜6 の目)。画像素材ゼロでブランドの
 * ダイスモチーフを使い回すための共通部品(Re-dice Store.dc.html 準拠)。
 *
 *  - 枠: 角丸ボーダー(サイズの 26%)
 *  - 目(pip): radial-gradient の円をサイズ比 7% の半径で配置
 *
 * 背景アンビエント(StoreAmbient)・カテゴリタイル(CategoryDice)・
 * CTA アイコンで共用する。
 */

export type DieFaceNumber = 1 | 2 | 3 | 4 | 5 | 6;

const FACES: Record<DieFaceNumber, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [32, 32],
    [68, 68],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [32, 32],
    [68, 32],
    [32, 68],
    [68, 68],
  ],
  5: [
    [29, 29],
    [71, 29],
    [50, 50],
    [29, 71],
    [71, 71],
  ],
  6: [
    [32, 26],
    [68, 26],
    [32, 50],
    [68, 50],
    [32, 74],
    [68, 74],
  ],
};

export function dieFaceBackground(
  color: string,
  face: DieFaceNumber,
  pipRadius: number,
): string {
  return FACES[face]
    .map(
      ([x, y]) =>
        `radial-gradient(circle ${pipRadius}px at ${x}% ${y}%, ${color} 95%, transparent)`,
    )
    .join(",");
}

export function DieFace({
  face,
  size,
  color,
  borderWidth = 2,
  className,
  style,
}: {
  face: DieFaceNumber;
  size: number;
  color: string;
  borderWidth?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: "block",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        border: `${borderWidth}px solid ${color}`,
        backgroundRepeat: "no-repeat",
        backgroundImage: dieFaceBackground(
          color,
          face,
          Math.max(2, Math.round(size * 0.07)),
        ),
        ...style,
      }}
    />
  );
}
