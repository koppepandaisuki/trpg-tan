import Link from "next/link";
import type { Route } from "next";
import { STORE_CATEGORIES } from "@/lib/format/category";
import type { ProductType } from "@/lib/queries/types";
import { cn } from "@/lib/utils";

interface CategoryTabsProps {
  current: ProductType | null;
}

/**
 * Category tabs. Clicking a tab navigates with `?category=...` and resets
 * pagination to page 1 (by not preserving `page` in the link).
 */
export function CategoryTabs({ current }: CategoryTabsProps) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-border" aria-label="カテゴリ">
      {STORE_CATEGORIES.map((c) => {
        const isActive = c.value === current;
        const href: Route = c.value ? (`/store?category=${c.value}` as Route) : "/store";
        return (
          <Link
            key={c.label}
            href={href}
            className={cn(
              "rounded-t-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "border-b-2 border-foreground font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {c.label}
          </Link>
        );
      })}
    </nav>
  );
}
