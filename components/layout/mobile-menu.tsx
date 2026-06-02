"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  Menu,
  X,
  Home,
  Store,
  PlusCircle,
  Library,
  LogOut,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type NavItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/store", label: "探す", icon: Store },
  { href: "/creator/products/new", label: "作成する", icon: PlusCircle },
  { href: "/library", label: "ライブラリ", icon: Library },
];

type CurrentUserLite = {
  displayName: string;
  email: string;
  isCreator: boolean;
  isAdmin: boolean;
  stripeChargesEnabled: boolean;
};

/**
 * モバイル向け drawer メニュー(< md で表示)。
 *
 * トリガーはハンバーガーボタン(top-header の右端 md:hidden 領域に配置)。
 * 押すと画面全体に被さる full-screen overlay を展開し、ナビ + ユーザー
 * 情報 + 認証アクションをまとめて表示する。
 *
 * デスクトップ(md+)では何も描画しない(top-header の既存
 * AuthedMenu / UnauthedMenu と nav が同等の機能を提供する)。
 *
 * Server Component の TopHeader から user 情報を props で受け取って
 * Client Component として state を持つ。
 */
export function MobileMenu({ user }: { user: CurrentUserLite | null }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* トリガー — モバイルだけ表示 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground md:hidden"
        aria-label="メニューを開く"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="メニュー"
          className="fixed inset-0 z-50 flex flex-col bg-background md:hidden"
        >
          {/* ヘッダー(close) */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
            <span className="text-sm font-semibold tracking-tight">メニュー</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="閉じる"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          {/* スクロール可能本体 */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* ナビ */}
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-md px-3 py-3 text-base text-foreground transition hover:bg-muted"
                  >
                    <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* 認証状態セクション */}
            <div className="mt-6 border-t border-border pt-6">
              {user ? (
                <AuthedSection user={user} onAction={() => setOpen(false)} />
              ) : (
                <UnauthedSection onAction={() => setOpen(false)} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AuthedSection({
  user,
  onAction,
}: {
  user: CurrentUserLite;
  onAction: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* ユーザー情報 */}
      <div>
        <p className="text-sm font-medium">
          {user.displayName || user.email}
        </p>
        {(user.isAdmin || user.isCreator) && (
          <div className="mt-1 flex flex-wrap gap-1">
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
          </div>
        )}
      </div>

      {/* Stripe 未接続バッジ(creator のみ) */}
      {user.isCreator && !user.stripeChargesEnabled && (
        <Link
          href="/creator/onboarding"
          onClick={onAction}
          className={cn(
            "flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900",
            "transition hover:bg-amber-100",
          )}
        >
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
          <span>Stripe 未接続 — 設定する</span>
        </Link>
      )}

      {/* Sign out */}
      <form action="/auth/sign-out" method="post">
        <Button type="submit" variant="outline" className="w-full">
          <LogOut className="h-4 w-4" aria-hidden />
          ログアウト
        </Button>
      </form>
    </div>
  );
}

function UnauthedSection({ onAction }: { onAction: () => void }) {
  return (
    <div className="space-y-2">
      <Link
        href="/login"
        onClick={onAction}
        className="flex w-full items-center justify-center rounded-md border border-border bg-card px-3 py-2.5 text-sm font-medium transition hover:bg-muted"
      >
        ログイン
      </Link>
      <Link
        href="/signup"
        onClick={onAction}
        className="flex w-full items-center justify-center rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
      >
        新規登録
      </Link>
    </div>
  );
}
