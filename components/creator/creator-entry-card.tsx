import Link from "next/link";
import type { Route } from "next";
import { Users, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * ホームの「クリエイターを探す」入口カード(EEEE)。CategoryGrid の下に
 * 並べて、「カテゴリで探す」と「人で探す」の 2 つの探し方を入口として
 * 並列に示す。
 *
 * 視覚言語:
 *  - rose/indigo グラデ(MMM = creator プロフィール hero と同系)
 *  - 大きめの Users アイコン(円形背景 + ring)
 *  - 装飾ブラー(他 hero と統一)
 *  - 右に「すべて見る → /creators」の Arrow ヒント
 *
 * Server Component(状態なし)。
 */
export function CreatorEntryCard() {
  return (
    <Link
      href={"/creators" as Route}
      className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label="クリエイター一覧を見る"
    >
      <Card className="overflow-hidden border-border bg-gradient-to-br from-rose-500/8 via-transparent to-sky-500/8 shadow-sm transition-all group-hover:border-foreground/20 group-hover:shadow-md">
        <CardContent className="relative flex flex-col items-start gap-4 py-6 sm:flex-row sm:items-center sm:py-7">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-rose-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-sky-500/10 blur-3xl" />

          {/* アイコン */}
          <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-rose-200 bg-rose-50 text-rose-700 transition-transform group-hover:scale-105">
            <Users className="h-7 w-7" aria-hidden />
          </div>

          {/* テキスト */}
          <div className="relative z-10 flex-1 space-y-0.5">
            <h3 className="text-lg font-semibold tracking-tight transition-colors group-hover:text-accent">
              クリエイターを探す
            </h3>
            <p className="text-xs text-muted-foreground sm:text-sm">
              公開作品を持つクリエイターを一覧表示。「人」から作品に出会う入口。
            </p>
          </div>

          {/* Arrow ヒント */}
          <div className="relative z-10 hidden items-center gap-1 text-xs text-muted-foreground transition-all group-hover:gap-2 group-hover:text-foreground sm:flex">
            <span>すべて見る</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
