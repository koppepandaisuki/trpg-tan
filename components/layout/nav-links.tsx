"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

/**
 * デスクトップ用グローバルナビ。現在地のタブをハイライトする(デスクトップアプリの
 * トップバーと同じ挙動)。usePathname を使うため Client Component。
 */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden h-full items-stretch gap-5 md:flex">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              // 下線のタブ(components/ui/tabs.tsx の underline と同じ見た目)。
              // 現在地は墨の太字 + 紅の下線。
              "flex items-center gap-1.5 border-b-2 px-0.5 text-sm transition-colors",
              active
                ? "border-primary font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
