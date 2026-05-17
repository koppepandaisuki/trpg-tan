import Link from "next/link";
import { Search, Bell, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/store", label: "探す" },
  { href: "/creator/products/new", label: "作成する" },
  { href: "/library", label: "ライブラリ" },
];

export function TopHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur",
        className,
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">
            T
          </span>
          <span className="text-sm font-semibold tracking-tight">TRPG プラットフォーム</span>
        </Link>

        <div className="hidden flex-1 max-w-xl md:block">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="シナリオ・ルールブック・素材を検索…"
              className="pl-9"
              disabled
              aria-label="検索(Phase 4で実装)"
            />
          </div>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" aria-label="通知(未実装)" disabled>
            <Bell className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" disabled>
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">ログイン</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
