import {
  Home,
  Store,
  PlusCircle,
  Library,
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
 * 「投稿する」表記の理由は TopHeader 側の注釈参照(Web は投稿のみ、
 * builder は Phase 2 で Desktop App に集約)。
 */
export type NavItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/store", label: "探す", icon: Store },
  { href: "/creator/products/new", label: "投稿する", icon: PlusCircle },
  { href: "/library", label: "ライブラリ", icon: Library },
];
