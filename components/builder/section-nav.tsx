import { cn } from "@/lib/utils";

export interface SectionNavItem {
  id: string;
  label: string;
  number?: number;
  disabled?: boolean;
}

interface SectionNavProps {
  items: SectionNavItem[];
  className?: string;
}

/**
 * Vertical anchor navigation for the builder.
 *
 * Phase 5 keeps this static (no IntersectionObserver-driven highlighting).
 * Clicking an item jumps to the corresponding section id within the form.
 */
export function SectionNav({ items, className }: SectionNavProps) {
  return (
    <nav
      className={cn(
        "space-y-1 rounded-lg border border-border bg-card p-2",
        className,
      )}
      aria-label="コンテンツツリー"
    >
      <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        コンテンツツリー
      </p>
      {items.map((item) => (
        <a
          key={item.id}
          href={item.disabled ? undefined : `#${item.id}`}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
            item.disabled
              ? "cursor-not-allowed text-muted-foreground/60"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          aria-disabled={item.disabled}
        >
          {item.number !== undefined && (
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
              {item.number}
            </span>
          )}
          <span className="truncate">{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
