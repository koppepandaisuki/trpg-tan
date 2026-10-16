import {
  FolderOpen,
  Users,
  Download,
  Dices,
  CalendarDays,
  ScrollText,
  CreditCard,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";

/**
 * グローバルナビゲーション項目の単一の真実源。
 *
 * TopHeader(Server Component)と MobileMenu(Client Component)の両方で
 * 共有するために独立ファイルに切り出す。Server → Client への props で
 * 関数値(Lucide の Icon Component)を渡せないため、両側で直接 import する。
 *
 * 2026-09 にストア(作品売買)を廃止したので「探す」「投稿する」は無い。
 * Re-dice は「卓を立てて遊ぶ道具」= PLAY とライブラリが主役。
 */
export type NavItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
};

/**
 * 主ナビ(ヘッダーの中央・スマホメニューの上段)。遊ぶための道具だけを並べる。
 * 「ホーム」はロゴがその役目なので置かない(大手サイトと同じ)。
 */
export const NAV_ITEMS: NavItem[] = [
  // ブラウザでそのまま卓を立てて遊べる(Web 版 PLAY)。
  { href: "/play" as Route, label: "PLAY", icon: Dices },
  // 自分の卓と素材(画像・音声)の保管庫。
  { href: "/library", label: "ライブラリ", icon: FolderOpen },
  // キャラクターシート(デスクトップと同じエディタ。ログインなしでも作れる)。
  { href: "/characters" as Route, label: "キャラシ", icon: ScrollText },
  { href: "/schedule/new" as Route, label: "日程調整", icon: CalendarDays },
  { href: "/friends" as Route, label: "フレンド", icon: Users },
];

/** 補助ナビ(ヘッダーの右・スマホメニューの下段)。 */
export const NAV_SECONDARY: NavItem[] = [
  // デスクトップアプリ(ビルダー等)の DL 導線。
  { href: "/download" as Route, label: "アプリ", icon: Download },
  { href: "/pricing" as Route, label: "料金", icon: CreditCard },
  { href: "/help" as Route, label: "ヘルプ", icon: LifeBuoy },
];

/** 現在地か(サブページも含む)。 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // 日程調整は作成ページ(/schedule/new)と回答ページ(/schedule/[token])をまとめて扱う。
  const base = href.startsWith("/schedule") ? "/schedule" : href;
  return pathname === base || pathname.startsWith(`${base}/`);
}
