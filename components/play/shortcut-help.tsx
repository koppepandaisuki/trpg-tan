"use client";

import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";
import { toolButton } from "@/components/ui/button";

/** GM のキーボード操作の一覧(「?」キーかボタンで開く)。 */
export const GM_SHORTCUTS: { keys: string; what: string }[] = [
  { keys: "/", what: "チャットの入力欄へ" },
  { keys: "Alt + 1〜9", what: "シーン 1〜9 に切り替え" },
  { keys: "Alt + ← / →", what: "前 / 次のシーンへ" },
  { keys: "Alt + B", what: "BGM を再生 / 停止(シーンに曲があればその曲)" },
  { keys: "Alt + Shift + 1〜9", what: "カットイン 1〜9 を出す" },
  { keys: "?", what: "この一覧を開く / 閉じる" },
];

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "?") setOpen((v) => !v);
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="キーボード操作(?)"
        className={toolButton}
      >
        <Keyboard className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">ショートカット</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-background p-4 text-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">キーボード操作(GM)</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="閉じる">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <dl className="space-y-1.5">
              {GM_SHORTCUTS.map((s) => (
                <div key={s.keys} className="flex gap-3">
                  <dt className="w-32 shrink-0">
                    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                      {s.keys}
                    </kbd>
                  </dt>
                  <dd className="text-muted-foreground">{s.what}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Mac では Alt は option キーです。Alt の操作はチャットに入力中でも使えます(← / → だけは入力欄の外で)。
            </p>
          </div>
        </div>
      )}
    </>
  );
}
