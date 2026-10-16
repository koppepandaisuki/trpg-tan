"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogIn, UserPlus, LogOut, MessageCircle, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { BrandMark } from "@/components/brand/brand-mark";
import { NAV_ITEMS, NAV_SECONDARY, isNavActive, type NavItem } from "./nav-items";
import { cn } from "@/lib/utils";

/**
 * モバイル(< md breakpoint)のヘッダーメニュー。
 *
 * 動作:
 *  - ハンバーガーボタンで開閉
 *  - 右側からスライドインのパネル(w-[88vw] max-w-sm)
 *  - 背景に半透明 backdrop + body scroll lock
 *  - Escape キー、backdrop クリック、内部の X ボタン、nav リンク
 *    クリックで閉じる
 *
 * 表示要素(上から):
 *  - ヘッダー: ロゴ + 閉じるボタン
 *  - ナビゲーション項目(NAV_ITEMS、TopHeader と共有)
 *  - Discord 招待リンク(env 設定時のみ)
 *  - ユーザー情報 + ログアウト(認証済)/ ログイン+新規登録(未認証)
 *
 * 設計判断:
 *  - 2026-09 のストア廃止で、作品検索とクリエイター導線は撤去した
 *  - md:hidden を外側の <div> に適用、デスクトップでは完全に DOM から消える
 */

interface MobileMenuUser {
  displayName: string;
  email: string;
  isAdmin: boolean;
}

interface MobileMenuProps {
  user: MobileMenuUser | null;
  discordUrl?: string;
}

export function MobileMenu({ user, discordUrl }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // パネルが開いている間は背景スクロールをロック(モバイル UX 標準)
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape で閉じる(キーボード操作可能性)
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      {/* Trigger: ハンバーガーボタン */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="メニューを開く"
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Overlay + Panel(open 時のみマウント)。ヘッダーは backdrop-blur を持つので、
          その中の position: fixed はヘッダーの箱(高さ 64px)に閉じ込められてしまう。
          body 直下へ portal で出す。 */}
      {open &&
        createPortal(
          <div
            id="mobile-menu-panel"
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-label="メニュー"
          >
            {/* Backdrop。button 化することで Tab で focus、Enter / Space で
              閉じられる(a11y)。 */}
            <button
              type="button"
              aria-label="メニューを閉じる(背景)"
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
              onClick={close}
            />

            {/* Panel - 右からスライド表示。z-index は overlay の上 */}
            <div className="absolute right-0 top-0 flex h-full w-[88vw] max-w-sm flex-col bg-background shadow-2xl">
              {/* Panel header */}
              <div className="flex h-16 items-center justify-between border-b border-border px-4">
                <BrandMark size="sm" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={close}
                  aria-label="メニューを閉じる"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* Navigation */}
                <nav className="space-y-1">
                  {NAV_ITEMS.map((item) => (
                    <MenuLink
                      key={item.href}
                      item={item}
                      active={isNavActive(pathname, item.href)}
                      onClick={close}
                    />
                  ))}
                </nav>
                {/* 補助(アプリ・料金・ヘルプ) */}
                <nav aria-label="補助" className="mt-4 space-y-1 border-t border-border pt-4">
                  {NAV_SECONDARY.map((item) => (
                    <MenuLink
                      key={item.href}
                      item={item}
                      active={isNavActive(pathname, item.href)}
                      onClick={close}
                      quiet
                    />
                  ))}
                </nav>

                {/* Discord 招待(env 設定時のみ)*/}
                {discordUrl && (
                  <div className="mt-6 border-t border-border pt-4">
                    <a
                      href={discordUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={close}
                      className="flex items-center gap-3 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink/85"
                    >
                      <MessageCircle className="h-5 w-5" aria-hidden />
                      <span>Discord で参加する</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Footer - ユーザーアクション */}
              <div className="border-t border-border p-4">
                {user ? (
                  <div className="space-y-3">
                    <Link
                      href="/account/settings"
                      onClick={close}
                      className="block min-w-0 rounded-md p-2 transition hover:bg-muted"
                    >
                      <p className="truncate text-sm font-medium">
                        {user.displayName || user.email}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        {user.isAdmin && (
                          <Badge variant="category" className="text-[10px]">
                            admin
                          </Badge>
                        )}
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Settings className="h-3 w-3" aria-hidden />
                          設定
                        </span>
                      </div>
                    </Link>
                    {/* form submit は close をスキップ(ナビゲーション完了で
                      自然に画面が切り替わる)*/}
                    <form action="/auth/sign-out" method="post">
                      <Button type="submit" variant="outline" size="sm" className="w-full">
                        <LogOut className="h-4 w-4" />
                        ログアウト
                      </Button>
                    </form>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/login"
                      onClick={close}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      <LogIn className="h-4 w-4" />
                      ログイン
                    </Link>
                    <Link
                      href="/signup"
                      onClick={close}
                      className={cn(buttonVariants({ variant: "ink", size: "sm" }))}
                    >
                      <UserPlus className="h-4 w-4" />
                      新規登録
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** メニューの 1 行。現在地は墨の太字 + 左の紅の縦線(ヘッダーの下線と同じ印)。 */
function MenuLink({
  item,
  active,
  onClick,
  quiet,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
  /** 補助リンク(少し小さく、薄く)。 */
  quiet?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 transition hover:bg-muted",
        quiet ? "py-2.5 text-[13px]" : "py-3 text-sm",
        active
          ? "bg-muted font-semibold text-foreground before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary"
          : quiet
            ? "text-muted-foreground"
            : "font-medium text-foreground",
      )}
    >
      <Icon
        className={cn("h-5 w-5", active ? "text-foreground" : "text-muted-foreground")}
        aria-hidden
      />
      <span>{item.label}</span>
    </Link>
  );
}
