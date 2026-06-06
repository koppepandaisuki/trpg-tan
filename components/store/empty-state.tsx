import Link from "next/link";
import type { Route } from "next";
import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * ストア空状態の汎用カード。Steam ライクなトップページ(`HomeHero`)と
 * 視覚言語を揃えるためグラデーション背景 + アイコンを採用。
 *
 * 用途:
 *   - カテゴリフィルタで「該当作品なし」 → フィルタ解除導線
 *   - 商品ゼロ「公開作品はまだない」 → creator 出品 / ホーム への導線
 */

interface ActionLink {
  href: Route;
  label: string;
}

interface EmptyStateProps {
  /** 説明的なアイコン(検索系 / 箱系 等)。HomeHero と統一感を出すため任意で指定 */
  icon?: LucideIcon;
  /** 大見出し */
  title: string;
  /** 補足説明 */
  description?: string;
  /** 主アクション(目立つボタン)*/
  primaryAction?: ActionLink;
  /** 副アクション(outline ボタン)*/
  secondaryAction?: ActionLink;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <Card className="overflow-hidden border-border bg-gradient-to-br from-sky-500/5 via-transparent to-violet-500/5 shadow-sm">
      <CardContent className="relative flex flex-col items-center gap-4 py-16 text-center">
        {/* 装飾の半透明ブラー(HomeHero と同じ手法)*/}
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />

        {Icon && (
          <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground backdrop-blur">
            <Icon className="h-6 w-6" aria-hidden />
          </div>
        )}

        <div className="relative z-10 space-y-1.5">
          <p className="text-base font-semibold tracking-tight">{title}</p>
          {description && (
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {(primaryAction || secondaryAction) && (
          <div className="relative z-10 mt-2 flex flex-wrap items-center justify-center gap-2">
            {primaryAction && (
              <Link
                href={primaryAction.href}
                className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
              >
                {primaryAction.label}
              </Link>
            )}
            {secondaryAction && (
              <Link
                href={secondaryAction.href}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {secondaryAction.label}
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
