import Link from "next/link";
import type { Route } from "next";
import { Download, Dices } from "lucide-react";

/**
 * トップに置くデスクトップアプリの DL 誘導バナー。
 * テスター配布期間中、ホームから 1 タップで /download に行けるようにする。
 */
export function AppDownloadCta() {
  return (
    <Link
      href={"/download" as Route}
      className="group flex items-center gap-4 overflow-hidden rounded-xl border border-sky-300/60 bg-gradient-to-br from-sky-500/12 via-transparent to-emerald-500/10 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-sky-300 bg-sky-50 text-sky-700 transition-transform duration-300 group-hover:scale-110">
        <Dices className="h-6 w-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-base font-bold tracking-tight">
          アプリで卓を囲もう
        </p>
        <p className="text-xs text-muted-foreground">
          オンラインセッション・シナリオ作成・キャラシが 1
          つに。買ったらそのまま遊べます（Windows・無料）。
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white">
        <Download className="h-4 w-4" aria-hidden />
        ダウンロード
      </span>
    </Link>
  );
}
