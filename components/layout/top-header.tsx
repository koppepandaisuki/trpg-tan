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
  MessageCircle,
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
        {/* ブランドロゴ。logo.png(public/)は「パラDa-iCE TRPGサイト」の
            横長ロゴで、すでにテキストを含むため別の text span は出さない。
            next/image を使うと width attribute が CSS の w-auto を打ち負け、
            画像が intrinsic 幅でレンダリングされて切れる問題があるため、
            素の <img> を使う(ヘッダーのロゴ 1 枚なので最適化メリットも
            限定的)。h-10 + w-auto で高さ基準にアスペクト比を保つ。 */}
        <Link
          href="/"
          className="flex shrink-0 items-center"
          aria-label="パラDa-iCE TRPGサイト ホーム"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="パラDa-iCE TRPGサイト"
            className="h-10 w-auto"
          />
        </Link>

        <div className="hidden flex-1 max-w-xl md:block">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="検索機能は準備中…(α 期間中は無効)"
              className="pl-9 pr-20"
              disabled
              aria-label="検索(準備中、Phase 2 以降で実装予定)"
            />
            {/* 「準備中」を視覚的に明示する右端バッジ。テスターが
                クリックして反応しないことを不審に思わないようにする */}
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              準備中
            </span>
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

      <DiscordOrBellButton />


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

/**
 * α 期間中の Discord 招待ボタン。env `NEXT_PUBLIC_ALPHA_DISCORD_INVITE_URL`
 * が設定されていれば MessageCircle アイコンの外部リンク、未設定なら
 * 従来通り disabled な通知ベルにフォールバック。
 *
 * Phase 2 で通知機能を本実装するときに DiscordOrBellButton 自体を撤去し、
 * 通常の通知 Bell + dropdown に置き換える想定。
 */
function DiscordOrBellButton() {
  const discordUrl = process.env.NEXT_PUBLIC_ALPHA_DISCORD_INVITE_URL;
  if (discordUrl) {
    return (
      <a
        href={discordUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="α テスター Discord に参加(別タブで開く)"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "text-indigo-700 hover:text-indigo-800",
        )}
      >
        <MessageCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Discord</span>
      </a>
    );
  }
  return (
    <Button variant="ghost" size="sm" aria-label="通知(未実装)" disabled>
      <Bell className="h-4 w-4" />
    </Button>
  );
}
