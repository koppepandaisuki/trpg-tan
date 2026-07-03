import Link from "next/link";
import type { Route } from "next";
import { Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * トップページ最上部の hero。Re-dice ブランド(青いダイス / 白い清潔感 /
 * 柔らかい光 / 小さな星のきらめき)。派手な装飾は避け、白い面 + 淡い青の
 * グラデーション + 少量の star sparkle で構成する。
 *
 * 主な役割:
 * - 「ここは何のサイトか」を 1 秒で伝える
 * - メインの導線(ストア / 作成する)に誘導
 */
export function HomeHero({ hasProducts }: { hasProducts: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary-soft via-white to-mint-soft p-8 shadow-sm sm:p-10">
      {/* 柔らかい光(青 + ミント)*/}
      <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-mint/15 blur-3xl" />

      {/* 小さな星のきらめき(少量)*/}
      <Sparkles
        className="pointer-events-none absolute right-8 top-7 h-5 w-5 text-gold/70"
        aria-hidden
      />
      <Sparkles
        className="pointer-events-none absolute right-24 top-20 h-3.5 w-3.5 text-primary/50"
        aria-hidden
      />
      <Sparkles
        className="pointer-events-none absolute bottom-8 right-16 h-4 w-4 text-mint/70"
        aria-hidden
      />

      <div className="relative max-w-2xl space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden />
          TRPG マーケットプレイス
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
          作って、買って、遊ぶ。
          <br className="hidden sm:inline" />
          TRPG の作品が集まる場所。
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
