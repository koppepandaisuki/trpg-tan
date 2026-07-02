import { useEffect, useState } from "react";

/**
 * ウィッシュリスト(ほしいものリスト)。localStorage の id 集合。
 * Toasts と同じモジュールレベル購読で、どのカードからでもトグルでき、
 * 右サイドバーの「ウィッシュリストのみ」フィルタと即時に同期する。
 * サーバ同期はしない(端末ローカル。将来アカウント同期に昇格可)。
 */

const KEY = "paradice.store.wishlist";

const listeners = new Set<() => void>();

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function write(ids: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    // 容量等で失敗しても致命ではない。
  }
  listeners.forEach((cb) => cb());
}

export function getWishlist(): Set<string> {
  return read();
}

export function toggleWish(id: string): boolean {
  const ids = read();
  const added = !ids.has(id);
  if (added) ids.add(id);
  else ids.delete(id);
  write(ids);
  return added;
}

/** React 用: ウィッシュリストの現在集合(変更で再レンダー)。 */
export function useWishlist(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => read());
  useEffect(() => {
    const cb = () => setIds(read());
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  return ids;
}
