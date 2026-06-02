import Link from "next/link";
import type { Route } from "next";
import { Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * トップページ最上部の hero。Steam の今週のおすすめ枠を模した
 * 控えめなランディング(α 期間中は実コンテンツが少ないため、
 * 派手な動画 / カルーセル背景は使わない)。
 *
 * 主な役割:
 * - 「ここは何のサイトか」を 1 秒で伝える
 * - メインの導線(ストア / 作成する)に誘導
 *
 * 実コンテンツ(商品 strip)は下に並ぶ。
 */
export function HomeHero({ hasProducts }: { hasProducts: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-rose-500/10 p-8 sm:p-10">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative max-w-2xl space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-violet-600" aria-hidden />
          TRPG マーケットプレイス
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
          シナリオ / アセット / パッケージを
          <br className="hidden sm:inline" />
          作って、買って、遊ぶ。
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          {hasProducts
            ? "クリエイターが公開した作品を一覧から、または下のおすすめから探してみてください。"
            : "まだ作品はこれからです。最初のクリエイターになって、あなたの作品を公開しましょう。"}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link
            href={"/store" as Route}
            className={cn(buttonVariants({ variant: "primary" }))}
          >
            ストアを見る
          </Link>
          <Link
            href={"/creator/products/new" as Route}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            作品を投稿する
          </Link>
        </div>
      </div>
    </section>
  );
}
