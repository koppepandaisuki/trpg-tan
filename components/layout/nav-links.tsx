"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, NAV_SECONDARY, isNavActive } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

/**
 * デスクトップ用グローバルナビ。現在地のタブをハイライトする(デスクトップアプリの
 * トップバーと同じ挙動)。usePathname を使うため Client Component。
 */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden h-full items-stretch gap-3 md:flex lg:gap-5">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isNavActive(pathname, item.href);
        // PLAY はサイトの主役なので紅の丸ボタン(デスクトップアプリの上部ナビと同じ)。
        if (item.href === "/play") {
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 self-center whitespace-nowrap rounded-full bg-primary px-4 text-sm font-bold tracking-wide text-primary-foreground shadow-brand transition-colors hover:bg-primary-hover",
                active && "ring-4 ring-primary/15",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              // 下線のタブ(components/ui/tabs.tsx の underline と同じ見た目)。
              // 現在地は墨の太字 + 紅の下線。
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-0.5 text-sm transition-colors",
              active
                ? "border-primary font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="hidden h-4 w-4 lg:block" aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * ヘッダー右の補助リンク(アプリ・料金)。lg はアイコンだけ、xl から文字も出す
 * (タブレット幅で主ナビの文字が折り返さないように)。md 以下はスマホメニュー・フッターから。
 */
export function SecondaryNavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="補助" className="hidden items-center gap-1 lg:flex">
      {NAV_SECONDARY.filter((i) => i.href !== "/help").map((item) => {
        const Icon = item.icon;
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            title={item.label}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] transition-colors",
              active
                ? "bg-muted font-semibold text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="hidden xl:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
