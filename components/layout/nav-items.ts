import {
  Home,
  FolderOpen,
  Users,
  Download,
  Dices,
  CalendarDays,
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

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ホーム", icon: Home },
  // ブラウザでそのまま卓を立てて遊べる(Web 版 PLAY)。
  { href: "/play" as Route, label: "PLAY", icon: Dices },
  // 自分の卓と素材(画像・音声)の保管庫。
  { href: "/library", label: "ライブラリ", icon: FolderOpen },
  { href: "/friends" as Route, label: "フレンド", icon: Users },
  { href: "/schedule/new" as Route, label: "日程調整", icon: CalendarDays },
  // デスクトップアプリ(キャラシ・ビルダー)の DL 導線。
  { href: "/download" as Route, label: "アプリ", icon: Download },
];
