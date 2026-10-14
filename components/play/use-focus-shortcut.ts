"use client";

import { useEffect, type RefObject } from "react";

/**
 * 「/」キーでチャットの入力欄へ移動する(入力中は効かない)。
 * GM も参加者も、マウスで入力欄を探さずに発言・ダイスに移れるように。
 */
export function useFocusShortcut(ref: RefObject<HTMLInputElement | HTMLTextAreaElement>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ref]);
}
