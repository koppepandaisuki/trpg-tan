"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/**
 * CharactersView をクライアントだけで描画する入口。
 *
 * エディタ(@trpg/ui)はデスクトップ SPA 由来で、描画中に localStorage を読む
 * (最近使ったシステム・自作システム)。サーバーで描くと localStorage が無い分だけ
 * 中身がずれてハイドレーションが失敗するので、SSR しない。
 * (エディタは操作する道具で、検索向けの本文ではないので SSR の利点も無い)
 */
export const CharactersViewClient = dynamic(
  () => import("./characters-view").then((m) => m.CharactersView),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        キャラシを読み込んでいます…
      </div>
    ),
  },
);
