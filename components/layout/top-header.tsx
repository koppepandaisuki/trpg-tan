import Link from "next/link";
import type { Route } from "next";
import {
  Search,
  Bell,
  LogOut,
  AlertCircle,
  Home,
  Store,
  PlusCircle,
  Library,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/session/get-user";
import { cn } from "@/lib/utils";

type NavItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/store", label: "探す", icon: Store },
  // Web 側は creator が「作った作品をアップロードして公開する」だけ。
  // 制作(ビルダー機能)は Phase 2 で Desktop App に集約予定のため、
  // Web の入口は「投稿する」表記で統一する。
  { href: "/creator/products/new", label: "投稿する", icon: PlusCircle },
  { href: "/library", label: "ライブラリ", icon: Library },
];

/**
 * Top-level header. Server Component so it can render auth state.
 * Sign-out is a small POST form to /auth/sign-out (CSRF-friendlier than GET).
 */
export async function TopHeader({ className }: { className?: string }) {
  const user = await getCurrentUser();

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
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? <AuthedMenu user={user} /> : <UnauthedMenu />}
        </div>
      </div>
    </header>
  );
}

function UnauthedMenu() {
  return (
    <>
      <Link
        href="/login"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
      >
        ログイン
      </Link>
      <Link
        href="/signup"
        className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
      >
        新規登録
      </Link>
    </>
  );
}

function AuthedMenu({
  user,
}: {
  user: {
    displayName: string;
    email: string;
    isCreator: boolean;
    isAdmin: boolean;
    stripeChargesEnabled: boolean;
  };
}) {
  return (
    <>
      {/* creator かつ Stripe 未接続のときだけ警告バッジを出す。クリックで
          onboarding ページへ。creator が「接続忘れ」のまま商品を作って詰む
          のを防ぐリマインダー。 */}
      {user.isCreator && !user.stripeChargesEnabled && (
        <Link
          href="/creator/onboarding"
          className="hidden items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 sm:inline-flex"
          aria-label="Stripe 接続が未完了です。クリックして設定に進む"
        >
          <AlertCircle className="h-3 w-3" aria-hidden />
          <span>Stripe 未接続</span>
        </Link>
      )}

      <Button variant="ghost" size="sm" aria-label="通知(未実装)" disabled>
        <Bell className="h-4 w-4" />
      </Button>

      <div className="hidden flex-col items-end leading-tight sm:flex">
        <span className="text-sm font-medium">{user.displayName || user.email}</span>
        <span className="flex gap-1">
          {user.isAdmin && (
            <Badge variant="category" className="text-[10px]">
              admin
            </Badge>
          )}
          {user.isCreator && (
            <Badge variant="muted" className="text-[10px]">
              creator
            </Badge>
          )}
        </span>
      </div>

      <form action="/auth/sign-out" method="post">
        <Button type="submit" variant="outline" size="sm">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">ログアウト</span>
        </Button>
      </form>
    </>
  );
}
