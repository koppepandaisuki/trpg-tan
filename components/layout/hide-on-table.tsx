"use client";

import { usePathname } from "next/navigation";

/**
 * 卓の画面(/play/<id>・/play/join/<code>)では出さない部品を包む。
 * 卓は画面いっぱいのアプリとして使う(サイトのフッターや浮いたボタンで盤面・
 * チャット入力欄を隠さない)。
 */
export function HideOnTable({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (/^\/play\/.+/.test(pathname ?? "")) return null;
  return <>{children}</>;
}
