import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";

/**
 * クリエイターメニュー(サイドバー nav)の共通コンポーネント(BBBBBB)。
 * dashboard / products / onboarding の各ページで current を切り替えて
 * 使い回す。disabled の項目はリンクにせず span で表示。
 *
 * Server Component。
 */
export type CreatorNavKey =
  | "dashboard"
  | "products"
  | "onboarding"
  | "analytics"
  | "settings";

interface NavItem {
  key: CreatorNavKey;
  label: string;
  href: Route;
  disabled?: boolean;
}

const ITEMS: NavItem[] = [
  { key: "dashboard", label: "ダッシュボード", href: "/creator/dashboard" },
  { key: "products", label: "作品管理", href: "/creator/products" },
  { key: "onboarding", label: "Stripe 接続", href: "/creator/onboarding" },
  {
    key: "analytics",
    label: "売上・分析",
    href: "/creator/dashboard",
    disabled: true,
  },
  {
    key: "settings",
    label: "設定",
    href: "/account/settings",
  },
];

export function CreatorNav({ current }: { current: CreatorNavKey }) {
  return (
    <nav className="space-y-1 rounded-lg border border-border bg-card p-2">
      <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        クリエイターメニュー
      </p>
      {ITEMS.map((item) => {
        const isCurrent = item.key === current;
        const baseClass = cn(
          "block rounded-md px-3 py-2 text-sm",
          isCurrent
            ? "bg-foreground/5 font-medium text-foreground"
            : "text-muted-foreground",
          item.disabled && "opacity-60",
        );
        if (item.disabled || isCurrent) {
          return (
            <span key={item.key} className={baseClass}>
              {item.label}
            </span>
          );
        }
        return (
          <Link
            key={item.key}
            href={item.href}
            className={cn(baseClass, "hover:bg-muted hover:text-foreground")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
