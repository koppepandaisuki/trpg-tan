import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * ボタン(ブランド共通)。形はすべて丸(rounded-full)。
 *
 *   - primary   紅。その画面で一番押してほしい操作(1 画面に 1〜2 個まで)
 *   - ink       墨。紅の次に強い操作 / 暗い面の上の操作
 *   - secondary 薄いグレーの面。並んだ道具・補助の操作
 *   - outline   白地 + 線。カードの中の操作・キャンセル
 *   - ghost     面なし。ヘッダーや密な道具バー
 *   - danger    削除など取り消せない操作
 *   - link      文中のリンク
 *
 * 押した状態(トグル)は aria-pressed を付けると墨で塗られる。
 * サイズ: xs(道具バー・チップ) / sm / md / lg / icon / icon-sm。
 */
const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold " +
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.97] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
    "disabled:pointer-events-none disabled:opacity-45 " +
    "aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-ink-foreground aria-pressed:hover:bg-ink/90",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-brand hover:bg-primary-hover",
        ink: "bg-ink text-ink-foreground hover:bg-ink/85",
        secondary: "bg-muted text-foreground hover:bg-border",
        outline:
          "border border-border bg-card text-foreground hover:border-foreground/25 hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        danger:
          "border border-border bg-card text-red-700 hover:border-red-300 hover:bg-red-50",
        link: "h-auto px-0 font-medium text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        xs: "h-7 px-3 text-xs [&_svg]:h-3.5 [&_svg]:w-3.5",
        sm: "h-8 px-3.5 text-[13px] [&_svg]:h-4 [&_svg]:w-4",
        md: "h-10 px-5 text-sm [&_svg]:h-4 [&_svg]:w-4",
        lg: "h-12 px-7 text-[15px] [&_svg]:h-5 [&_svg]:w-5",
        icon: "h-9 w-9 p-0 [&_svg]:h-4 [&_svg]:w-4",
        "icon-sm": "h-7 w-7 p-0 [&_svg]:h-3.5 [&_svg]:w-3.5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

/** 道具バー・カードの中の小さいボタン(白地 + 線の丸)。一番よく使う組み合わせ。 */
const toolButton = buttonVariants({ variant: "outline", size: "xs" });

export { buttonVariants, toolButton };
