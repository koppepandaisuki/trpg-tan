"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductType } from "@/lib/queries/types";

/**
 * 「お気に入り」を localStorage で管理する hook。XXX (recently viewed) と
 * 同じパターンだが、こちらは「ユーザーが明示的に保存する」もの。
 *
 * 設計:
 *  - キー: paradice_favorites_v1
 *  - 最大 MAX_ITEMS 件(古いものから消える FIFO)
 *  - 重複なし: toggle で on/off
 *  - 保存される値は表示に必要な最小限の field(slug, title, coverUrl, ...)
 *    coverUrl は解決済 URL(server で publicCoverUrl 経由)を渡す前提
 *  - サーバ送信ゼロ(端末ローカルのみ、プライバシー的に安心)
 *
 * SSR との不整合を避けるため、初期値は []、mount 後の useEffect で hydrate。
 *
 * 重複や上限超過のとき:
 *  - 既存 slug を toggle すると除去
 *  - 新規追加で MAX を超えるとき、古いものから消える(FIFO)
 */

const STORAGE_KEY = "paradice_favorites_v1";
const MAX_ITEMS = 100;

export interface FavoriteItem {
  slug: string;
  title: string;
  coverUrl: string | null;
  productType: ProductType;
  priceJpy: number;
  systemLabel: string | null;
  creator: {
    id: string;
    displayName: string;
  };
  /** epoch ms。新しい順に並べるためのキー */
  favoritedAt: number;
}

function readStorage(): FavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidItem);
  } catch {
    return [];
  }
}

function writeStorage(items: FavoriteItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // QuotaExceeded などは黙って無視
  }
}

function isValidItem(v: unknown): v is FavoriteItem {
  if (!v || typeof v !== "object") return false;
  const it = v as Record<string, unknown>;
  return (
    typeof it.slug === "string" &&
    typeof it.title === "string" &&
    typeof it.productType === "string" &&
    typeof it.priceJpy === "number" &&
    typeof it.favoritedAt === "number" &&
    (it.coverUrl === null || typeof it.coverUrl === "string")
  );
}

/**
 * お気に入り全件(新しい順)。表示側で使う。
 */
export function useFavorites(): FavoriteItem[] {
  const [items, setItems] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    setItems(readStorage());

    // 別タブの変更 → storage event
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setItems(readStorage());
      }
    }
    // 同一タブ内の変更 → useToggleFavorite が dispatch する CustomEvent
    function onLocal() {
      setItems(readStorage());
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("paradice:favorites-changed", onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("paradice:favorites-changed", onLocal);
    };
  }, []);

  return items;
}

/**
 * 特定 slug がお気に入り済かどうかを返す。商品詳細の Heart icon 状態を
 * 決めるのに使う。
 */
export function useIsFavorited(slug: string): boolean {
  const items = useFavorites();
  return items.some((it) => it.slug === slug);
}

/**
 * お気に入りを toggle する。stable な参照を返すため useCallback。
 *
 * 動作:
 *  - すでに含まれていれば除去
 *  - なければ先頭に追加(MAX 超過なら末尾を切る)
 *  - 同一タブ内の他コンポーネント(useFavorites)も「storage」では発火
 *    しないので、setState のための再 read を呼ぶ必要があるが、シンプル
 *    実装ではタブごとに再マウントで OK。商品詳細のボタンと strip 表示は
 *    別ページなので問題ない。
 */
export function useToggleFavorite() {
  return useCallback((item: Omit<FavoriteItem, "favoritedAt">): boolean => {
    const existing = readStorage();
    const isAlready = existing.some((it) => it.slug === item.slug);
    let next: FavoriteItem[];
    if (isAlready) {
      next = existing.filter((it) => it.slug !== item.slug);
    } else {
      next = [
        { ...item, favoritedAt: Date.now() },
        ...existing,
      ].slice(0, MAX_ITEMS);
    }
    writeStorage(next);
    // 同一タブ内通知のため、custom event を dispatch
    try {
      window.dispatchEvent(new CustomEvent("paradice:favorites-changed"));
    } catch {
      // ignore
    }
    return !isAlready;
  }, []);
}
