import { Fragment } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Home, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * サイト共通のパンくずコンポーネント。
 *
 * 設計判断:
 *  - ChevronRight 区切り(従来の `›` ASCII より視覚密度が高く、サイトの
 *    Lucide アイコン体系と統一)
 *  - 先頭に Home アイコンを自動付加(`withHome={true}` 既定)。サイトの
 *    どこからでも「ホームに戻る」入口を確保
 *  - 各 item に optional の Lucide アイコン(セクションの色を載せた
 *    視覚記号として機能 — 例: 「ストア → 作品名」なら Store icon)
 *  - 最後の item は非リンクで font-medium + text-foreground(現在地強調)
 *  - aria-current="page" + aria-label="パンくず" で screen reader 対応
 *
 * Server Component。
 */
export type BreadcrumbItem = {
  /** undefined のときは非リンク表示(最後の項目 = 現在地)*/
  href?: Route;
  label: string;
  icon?: LucideIcon;
};

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /**
   * 先頭にホームを自動付加するか(既定 true)。
   * 既に items[0] に Home を含めたい場合や、ホームを出したくない特殊
   * ページでは `false` にする。
   */
  withHome?: boolean;
  className?: string;
}

export function Breadcrumb({
  items,
  withHome = true,
  className,
}: BreadcrumbProps) {
  const all: BreadcrumbItem[] = withHome
    ? [{ href: "/" as Route, label: "ホーム", icon: Home }, ...items]
    : items;

  return (
    <nav
      aria-label="パンくず"
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      {all.map((item, i) => {
        const isLast = i === all.length - 1;
        const Icon = item.icon;
        return (
          <Fragment key={`${item.label}-${i}`}>
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="inline-flex items-center gap-1 rounded-sm transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
                <span>{item.label}</span>
              </Link>
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  isLast && "font-medium text-foreground",
                )}
                aria-current={isLast ? "page" : undefined}
              >
                {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
                <span className="line-clamp-1 break-all">{item.label}</span>
              </span>
            )}
            {!isLast && (
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50"
                aria-hidden
              />
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
