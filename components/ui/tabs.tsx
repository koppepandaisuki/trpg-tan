import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * タブ(ブランド共通)。選択中は墨(赤 = 行動、墨 = 状態)。
 *
 *   - segmented  グレーの溝に丸いタブ。道具の切り替え(卓の右列など)
 *   - underline  下線のタブ。ページ内の大きな切り替え・ヘッダーのナビ。
 *                選択中の下線だけ紅(現在地の印)
 *
 * 選択中は aria-selected(タブ)/ aria-current="page"(ナビのリンク)で表す。
 */
const tabListVariants = cva("", {
  variants: {
    variant: {
      segmented: "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-muted p-1",
      underline: "flex items-end gap-5 overflow-x-auto border-b border-border",
    },
  },
  defaultVariants: { variant: "segmented" },
});

const tabVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 " +
    "disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        segmented:
          "h-7 rounded-full px-3 text-xs font-semibold text-muted-foreground hover:text-foreground " +
          "aria-selected:bg-ink aria-selected:text-ink-foreground aria-[current=page]:bg-ink aria-[current=page]:text-ink-foreground " +
          "[&_svg]:h-3.5 [&_svg]:w-3.5",
        underline:
          "-mb-px h-10 border-b-2 border-transparent px-0.5 text-sm font-medium text-muted-foreground hover:text-foreground " +
          "aria-selected:border-primary aria-selected:font-semibold aria-selected:text-foreground " +
          "aria-[current=page]:border-primary aria-[current=page]:font-semibold aria-[current=page]:text-foreground " +
          "[&_svg]:h-4 [&_svg]:w-4",
      },
    },
    defaultVariants: { variant: "segmented" },
  },
);

type TabVariant = VariantProps<typeof tabVariants>["variant"];

export function TabList({
  variant,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: TabVariant }) {
  return <div role="tablist" className={cn(tabListVariants({ variant }), className)} {...props} />;
}

export function Tab({
  variant,
  selected,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: TabVariant; selected: boolean }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={cn(tabVariants({ variant }), className)}
      {...props}
    />
  );
}

/**
 * チップ(絞り込み・よく使う判定・ダイスの定型など、小さく並ぶ選択肢)。
 * 押した状態は aria-pressed で墨になる。
 */
const chipVariants = cva(
  "inline-flex h-7 shrink-0 select-none items-center justify-center gap-1 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 " +
    "disabled:pointer-events-none disabled:opacity-45 " +
    "aria-pressed:bg-ink aria-pressed:text-ink-foreground [&_svg]:h-3.5 [&_svg]:w-3.5",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground hover:bg-border",
        /** 紅の縁取り: 押すとすぐ振る・送るもの(よく使う判定) */
        action: "border border-primary/25 bg-card text-primary hover:border-primary/50 hover:bg-primary-soft",
        mono: "bg-muted font-mono text-foreground hover:bg-border",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export { tabListVariants, tabVariants, chipVariants };
