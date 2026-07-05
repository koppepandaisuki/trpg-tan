import { useEffect, useState } from "react";

/**
 * 開発者(クリエイター)フォロー。localStorage の id→表示名マップ。
 * wishlist.ts と同じモジュールレベル購読方式で、商品詳細のフォローボタンと
 * 右サイドバーの「フォロー中の開発者」フィルタが即時に同期する。
 * サーバ同期はしない(端末ローカル。将来アカウント同期に昇格可)。
 */

const KEY = "paradice.store.follows";

const listeners = new Set<() => void>();

function read(): Map<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as unknown;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return new Map(
        Object.entries(obj as Record<string, unknown>).filter(
          (e): e is [string, string] => typeof e[1] === "string",
        ),
      );
    }
    return new Map();
  } catch {
    return new Map();
  }
}

function write(m: Map<string, string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(m)));
  } catch {
    // 保存失敗は致命ではない。
  }
  listeners.forEach((cb) => cb());
}

export function getFollows(): Map<string, string> {
  return read();
}

/** フォロー切替。追加したら true。 */
export function toggleFollow(creatorId: string, name: string): boolean {
  const m = read();
  const added = !m.has(creatorId);
  if (added) m.set(creatorId, name);
  else m.delete(creatorId);
  write(m);
  return added;
}

/** React 用: フォロー中の id→名前(変更で再レンダー)。 */
export function useFollows(): Map<string, string> {
  const [m, setM] = useState<Map<string, string>>(() => read());
  useEffect(() => {
    const cb = () => setM(read());
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  return m;
}
