"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductType } from "@/lib/queries/types";

/**
 * 「最近見た作品」を localStorage で管理する hook。
 *
 * 設計:
 *  - キー: paradice_recent_views_v1
 *  - 最大 MAX_ITEMS 件(古いものから消える FIFO)
 *  - 重複なし: 同じ slug を再記録すると、その項目を先頭に移動するだけ
 *    (count は数えない、純粋に直近の順序のみ)
 *  - データは表示に必要な最小限のフィールドだけ保存
 *    (productId は記録しない — slug があれば fetch 不要で WorkCard が
 *     表示できる、kept-by-design)
 *  - サーバ送信ゼロ(プライバシー: 履歴は端末ローカルのみ)
 *
 * SSR との不整合:
 *  - サーバ側は localStorage を持たないので、初期値は常に []
 *  - mount 後の useEffect で読み出し、setItems で hydrate
 *  - これにより hydration mismatch 警告を避ける
 *
 * 複数タブ同期は意図的にしない(直近で見た「自分の」アクションを尊重)。
 */

const STORAGE_KEY = "paradice_recent_views_v1";
const MAX_ITEMS = 12;

export interface RecentViewItem {
  slug: string;
  title: string;
  /**
   * 表示用の完全な URL。lib/format/storage.ts (server-only) を経由した
   * publicCoverUrl の結果を、商品詳細(Server Component)で解決して渡す。
   * Client 側で再解決しないので server-only 制約を回避できる。
   */
  coverUrl: string | null;
  productType: ProductType;
  priceJpy: number;
  systemLabel: string | null;
  creator: {
    id: string;
    displayName: string;
  };
  /** epoch ms。新しい順に並べるためのキー */
  viewedAt: number;
}

function readStorage(): RecentViewItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // 型整合チェック(壊れた値が紛れ込んでも落ちないように)
    return parsed.filter(isValidItem);
  } catch {
    return [];
  }
}

function writeStorage(items: RecentViewItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // QuotaExceeded などは黙って無視(履歴機能なので致命ではない)
  }
}

function isValidItem(v: unknown): v is RecentViewItem {
  if (!v || typeof v !== "object") return false;
  const it = v as Record<string, unknown>;
  return (
    typeof it.slug === "string" &&
    typeof it.title === "string" &&
    typeof it.productType === "string" &&
    typeof it.priceJpy === "number" &&
    typeof it.viewedAt === "number" &&
    (it.coverUrl === null || typeof it.coverUrl === "string")
  );
}

/**
 * 「最近見た作品」の読み出し用 hook。表示側で使う。
 * mount 後の最初の useEffect で localStorage から読み出して set する。
 */
export function useRecentViews(): RecentViewItem[] {
  const [items, setItems] = useState<RecentViewItem[]>([]);

  useEffect(() => {
    setItems(readStorage());
  }, []);

  return items;
}

/**
 * 「最近見た作品」を 1 件追加する hook。商品詳細ページの mount 時に
 * 呼ぶ想定。useCallback で安定参照を返し、useEffect から呼んでも
 * 無限ループにならない。
 *
 * 同じ slug がある場合は先頭に移動するだけ(履歴の純度を保つ)。
 */
export function useRecordView() {
  return useCallback((item: Omit<RecentViewItem, "viewedAt">) => {
    const existing = readStorage();
    // 同 slug を除外して新値を先頭に
    const next: RecentViewItem[] = [
      { ...item, viewedAt: Date.now() },
      ...existing.filter((it) => it.slug !== item.slug),
    ].slice(0, MAX_ITEMS);
    writeStorage(next);
  }, []);
}

/**
 * 履歴を全消去する hook(将来の「履歴クリア」ボタン用、現状未使用)。
 */
export function useClearRecentViews() {
  return useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);
}
