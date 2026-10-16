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
      className="group flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-colors duration-200 group-hover:bg-primary">
        <Dices className="h-6 w-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-base font-bold tracking-tight">
          アプリで卓を囲もう
        </p>
        <p className="text-xs text-muted-foreground">
          オンラインセッション・シナリオ作成・キャラシが 1
          つに（Windows・無料）。
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-brand transition-colors group-hover:bg-primary-hover">
        <Download className="h-4 w-4" aria-hidden />
        ダウンロード
      </span>
    </Link>
  );
}
