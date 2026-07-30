"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Dices, Loader2 } from "lucide-react";
import { createScene } from "@trpg/core";
import { savePlayScene } from "@/lib/play/store";
import { cn } from "@/lib/utils";

/**
 * ライブラリの作品から Web PLAY の卓を立てる。
 *
 * 作品名をタイトルにした卓を作って /play/<id> へ。買った作品をそのまま
 * 遊びに繋げる導線(デスクトップ版の「PLAY で開く」に相当)。
 * 現状は空の盤面を用意するところまで(作品ファイルの取り込みは
 * デスクトップ版のフルパッケージ機能側)。
 */
export function StartPlayButton({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const scene = createScene({
        id: crypto.randomUUID(),
        title,
        now: new Date().toISOString(),
      });
      await savePlayScene(scene);
      router.push(`/play/${scene.id}` as Route);
    } catch (e) {
      setError(e instanceof Error ? e.message : "卓を作れませんでした");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => void start()}
        disabled={busy}
        aria-label={`「${title}」で卓を立てる`}
        className={cn(
          "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 transition hover:border-red-300 hover:bg-red-100 disabled:opacity-50",
          className,
        )}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Dices className="h-3.5 w-3.5" aria-hidden />
        )}
        {busy ? "作成中…" : "この作品で卓を立てる"}
      </button>
      {error && <p className="text-[11px] text-red-700">{error}</p>}
    </>
  );
}
