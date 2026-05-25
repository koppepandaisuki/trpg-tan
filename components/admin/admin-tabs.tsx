import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";

const TABS: Array<{ href: Route; label: string; match: (p: string) => boolean }> = [
  { href: "/admin/users", label: "ユーザー", match: (p) => p.startsWith("/admin/users") },
  { href: "/admin/products", label: "作品", match: (p) => p.startsWith("/admin/products") },
  { href: "/admin/orders", label: "取引", match: (p) => p.startsWith("/admin/orders") },
];

export function AdminTabs({ pathname }: { pathname: string }) {
  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-border"
      aria-label="admin タブ"
    >
      {TABS.map((tab) => {
        const isActive = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-t-md px-4 py-2 text-sm transition-colors",
              isActive
                ? "border-b-2 border-foreground font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
