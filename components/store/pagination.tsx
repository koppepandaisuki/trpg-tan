import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StorePaginationProps {
  page: number;
  totalPages: number;
  /** Build href for a given page number (caller controls query preservation). */
  buildHref: (page: number) => Route;
}

export function StorePagination({ page, totalPages, buildHref }: StorePaginationProps) {
  if (totalPages <= 1) return null;

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  const linkBase = buttonVariants({ variant: "outline", size: "sm" });
  const disabledClass = "pointer-events-none opacity-50";

  return (
    <nav
      aria-label="ページネーション"
      className="flex items-center justify-center gap-3 pt-8"
    >
      <Link
        href={buildHref(Math.max(1, page - 1))}
        className={cn(linkBase, prevDisabled && disabledClass)}
        aria-disabled={prevDisabled}
        tabIndex={prevDisabled ? -1 : 0}
      >
        <ChevronLeft className="h-4 w-4" />
        前へ
      </Link>

      <span className="text-sm text-muted-foreground">
        {page} / {totalPages} ページ
      </span>

      <Link
        href={buildHref(Math.min(totalPages, page + 1))}
        className={cn(linkBase, nextDisabled && disabledClass)}
        aria-disabled={nextDisabled}
        tabIndex={nextDisabled ? -1 : 0}
      >
        次へ
        <ChevronRight className="h-4 w-4" />
      </Link>
    </nav>
  );
}
