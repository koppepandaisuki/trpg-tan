import { useEffect, useState } from "react";

/**
 * トースト通知(保存完了・コピー等の軽いフィードバック)。
 * どこからでも `toast("✓ 保存しました")` で発火でき、画面下中央に
 * 2.6 秒だけ表示される。状態は持たない(モジュールレベルの購読)。
 */

interface ToastItem {
  id: number;
  text: string;
}

const listeners = new Set<(t: ToastItem) => void>();
let seq = 0;

/** トーストを 1 つ出す(全画面共通)。 */
export function toast(text: string) {
  const t = { id: ++seq, text };
  listeners.forEach((cb) => cb(t));
}

const TOAST_MS = 2600;

/** App のルートに 1 つだけ置くコンテナ。 */
export function Toasts() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const cb = (t: ToastItem) => {
      setItems((xs) => [...xs.slice(-2), t]); // 最大 3 つまで
      window.setTimeout(() => {
        setItems((xs) => xs.filter((x) => x.id !== t.id));
      }, TOAST_MS);
    };
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  if (items.length === 0) return null;
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="toast">
          {t.text}
        </div>
      ))}
    </div>
  );
}
