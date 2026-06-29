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
    <nav className="hidden items-center gap-1 md:flex">
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
              "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition",
              active
                ? "bg-primary-soft font-semibold text-primary"
                : "text-muted-foreground hover:bg-primary-soft hover:text-primary",
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
