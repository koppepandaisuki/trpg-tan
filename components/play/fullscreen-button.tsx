"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

/**
 * 卓を全画面にする(ブラウザのタブやアドレスバーを消して卓だけを出す)。
 * 卓の画面はもともと画面いっぱいのレイアウトなので、そのまま没入できる。
 * 全画面に対応しないブラウザ(iPhone の Safari など)ではボタンを出さない。
 */
export function FullscreenButton() {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);

  useEffect(() => {
    setSupported(!!document.fullscreenEnabled);
    const sync = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => {});
      }}
      title={on ? "全画面を終える(Esc)" : "全画面にする(卓だけを表示)"}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs transition hover:bg-muted"
    >
      {on ? (
        <Minimize2 className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Maximize2 className="h-3.5 w-3.5" aria-hidden />
      )}
      <span className="hidden sm:inline">{on ? "全画面を終える" : "全画面"}</span>
    </button>
  );
}
