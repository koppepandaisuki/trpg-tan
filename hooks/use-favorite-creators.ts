"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 「お気に入りクリエイター」を localStorage で管理する hook(VVVV)。
 * 作品用の use-favorites と同じ思想だが、別 storage key + 別 shape で
 * 「人」を保存する。
 *
 * 設計:
 *  - キー: paradice_favorite_creators_v1
 *  - 最大 100 件(FIFO)
 *  - toggle で on/off、重複なし
 *  - avatarUrl は server で publicAvatarUrl 解決済を渡す前提
 *  - サーバ送信ゼロ(端末ローカル)
 *
 * 同一タブ同期: useToggleFavoriteCreator が CustomEvent を dispatch、
 * useFavoriteCreators が購読して再 read する。別タブは storage event。
 */

const STORAGE_KEY = "paradice_favorite_creators_v1";
const CHANGE_EVENT = "paradice:favorite-creators-changed";
const MAX_ITEMS = 100;

export interface FavoriteCreatorItem {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** epoch ms。新しい順に並べる */
  favoritedAt: number;
}

function readStorage(): FavoriteCreatorItem[] {
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

function writeStorage(items: FavoriteCreatorItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // QuotaExceeded などは無視
  }
}

function isValidItem(v: unknown): v is FavoriteCreatorItem {
  if (!v || typeof v !== "object") return false;
  const it = v as Record<string, unknown>;
  return (
    typeof it.id === "string" &&
    typeof it.displayName === "string" &&
    typeof it.favoritedAt === "number" &&
    (it.avatarUrl === null || typeof it.avatarUrl === "string")
  );
}

/**
 * お気に入りクリエイター全件(新しい順)。表示側で使う。
 */
export function useFavoriteCreators(): FavoriteCreatorItem[] {
  const [items, setItems] = useState<FavoriteCreatorItem[]>([]);

  useEffect(() => {
    setItems(readStorage());

    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setItems(readStorage());
    }
    function onLocal() {
      setItems(readStorage());
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVENT, onLocal);
    };
  }, []);

  return items;
}

/**
 * 特定 creator がお気に入り済かどうか。プロフィールの Heart ボタン用。
 */
export function useIsCreatorFavorited(creatorId: string): boolean {
  const items = useFavoriteCreators();
  return items.some((it) => it.id === creatorId);
}

/**
 * creator お気に入りを toggle。stable callback。
 *  - 既存 → 除去
 *  - 新規 → 先頭追加(MAX 超過なら末尾 trim)
 *  - CustomEvent dispatch で同一タブ同期
 * 戻り値: toggle 後に「お気に入り状態か」を返す。
 */
export function useToggleFavoriteCreator() {
  return useCallback(
    (creator: Omit<FavoriteCreatorItem, "favoritedAt">): boolean => {
      const existing = readStorage();
      const isAlready = existing.some((it) => it.id === creator.id);
      let next: FavoriteCreatorItem[];
      if (isAlready) {
        next = existing.filter((it) => it.id !== creator.id);
      } else {
        next = [
          { ...creator, favoritedAt: Date.now() },
          ...existing,
        ].slice(0, MAX_ITEMS);
      }
      writeStorage(next);
      try {
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
      } catch {
        // ignore
      }
      return !isAlready;
    },
    [],
  );
}
