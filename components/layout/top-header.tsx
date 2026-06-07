import Link from "next/link";
import {
  Bell,
  LogOut,
  AlertCircle,
  MessageCircle,
  LayoutDashboard,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/brand/brand-mark";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { SearchBar } from "@/components/layout/search-bar";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { PresenceHeartbeat } from "@/components/friends/presence-heartbeat";
import { getCurrentUser } from "@/lib/session/get-user";
import { cn } from "@/lib/utils";

/**
 * Top-level header. Server Component so it can render auth state.
 * Sign-out is a small POST form to /auth/sign-out (CSRF-friendlier than GET).
 *
 * Responsive 構造:
 *  - < md: ロゴ + ハンバーガー(MobileMenu)のみ
 *  - >= md: ロゴ + 検索バー + nav + ユーザーメニュー(現状維持)
 *
 * NAV_ITEMS は MobileMenu と共有するため components/layout/nav-items.ts に
 * 切り出し済(Server → Client の props で Lucide Icon Component を渡せない
 * 問題回避)。
 */
export async function TopHeader({ className }: { className?: string }) {
  const user = await getCurrentUser();
  const discordUrl = process.env.NEXT_PUBLIC_ALPHA_DISCORD_INVITE_URL;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur",
        className,
      )}
    >
      {/* ログイン中は在席の心拍を打つ(描画なし) */}
      {user && <PresenceHeartbeat />}
      <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center"
          aria-label="パラDa-iCE TRPGサイト ホーム"
        >
          <BrandMark size="md" />
        </Link>

        {/* 検索バー(デスクトップのみ。モバイルは MobileMenu 内に配置)。
            IIIII で実機能化:Enter で /store?q= に遷移。 */}
        <div className="hidden flex-1 max-w-xl md:block">
          <SearchBar />
        </div>

        {/* デスクトップ用 nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-primary-soft hover:text-primary"
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* デスクトップ用ユーザーメニュー */}
          <div className="hidden items-center gap-2 md:flex">
            {user ? <AuthedMenu user={user} /> : <UnauthedMenu />}
          </div>

          {/* モバイル用ハンバーガー(MobileMenu の中で md:hidden 制御) */}
          <MobileMenu
            user={
              user
                ? {
                    displayName: user.displayName,
                    email: user.email,
                    isCreator: user.isCreator,
                    isAdmin: user.isAdmin,
                    stripeChargesEnabled: user.stripeChargesEnabled,
                  }
                : null
            }
            discordUrl={discordUrl}
          />
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

      {/* creator はヘッダーから 1 クリックでダッシュボードへ(DDDDDD)。
          作品管理 / 売上集計の起点。creator でないユーザーには出さない。 */}
      {user.isCreator && (
        <Link
          href="/creator/dashboard"
          className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground lg:inline-flex"
          aria-label="クリエイターダッシュボードを開く"
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden />
          <span>ダッシュボード</span>
        </Link>
      )}

      <DiscordOrBellButton />

      {/* 表示名 + ロールバッジ全体をプロフィール設定リンクに。
          自分の名前をクリック → 自分の設定 という直感的な動線。 */}
      <Link
        href="/account/settings"
        className="hidden flex-col items-end leading-tight transition hover:opacity-80 sm:flex"
        aria-label="プロフィール設定を開く"
      >
        <span className="text-sm font-medium">
          {user.displayName || user.email}
        </span>
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
      </Link>

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
          "text-sky-700 hover:text-sky-800",
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
