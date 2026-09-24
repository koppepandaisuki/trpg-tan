import Link from "next/link";
import type { Route } from "next";
import {
  CalendarDays,
  Dices,
  FolderOpen,
  Hammer,
  ScrollText,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { AppDownloadCta } from "@/components/home/app-download-cta";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session/get-user";
import { listMyPlaySessions } from "@/lib/queries/play-sessions";
import { cn } from "@/lib/utils";

/**
 * トップページ。
 *
 * 2026-09 にストア(作品売買)を廃止し、Re-dice は「卓を立てて遊ぶ道具」に
 * 絞った。トップは その道具の入口 = PLAY / ライブラリ / キャラシ /
 * ビルダー / フレンド / 日程調整 を並べる。
 *
 * ログイン中は自分の卓を最近のものから出して、すぐ再開できるようにする。
 */

// root layout の title.default に任せる(「Re-dice TRPGサイト」)。

interface Feature {
  href: Route;
  icon: LucideIcon;
  title: string;
  body: string;
  /** ブラウザでは使えず、デスクトップアプリで使う機能。 */
  appOnly?: boolean;
}

const FEATURES: Feature[] = [
  {
    href: "/play" as Route,
    icon: Dices,
    title: "PLAY",
    body: "ブラウザで卓を立てて、参加コードを渡すだけでセッション開始。盤面・ダイス・BGM・カットインまで。",
  },
  {
    href: "/library" as Route,
    icon: FolderOpen,
    title: "ライブラリ",
    body: "立てた卓と、背景・駒・BGM などの素材をまとめて保管。次のセッションでそのまま使えます。",
  },
  {
    href: "/download" as Route,
    icon: ScrollText,
    title: "キャラシ",
    body: "13 システム対応のキャラクターシート。能力値からチャットパレットまで自動で作れます。",
    appOnly: true,
  },
  {
    href: "/download" as Route,
    icon: Hammer,
    title: "ビルダー",
    body: "自作シナリオ(あらすじ・HO・NPC・シーン)や独自システムを組み立てて、そのまま卓に。",
    appOnly: true,
  },
  {
    href: "/friends" as Route,
    icon: Users,
    title: "フレンド",
    body: "いつもの仲間を登録して、卓にワンタップで招待。",
  },
  {
    href: "/schedule/new" as Route,
    icon: CalendarDays,
    title: "日程調整",
    body: "候補日を並べて URL を共有するだけ。全員の都合が一目でわかります。",
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const recent = user ? (await listMyPlaySessions(user.id)).slice(0, 3) : [];

  return (
    <>
      <TopHeader />
      <PageContainer className="space-y-10 py-8">
        {/* ===== Hero ===== */}
        <section className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary-soft via-white to-mint-soft p-8 shadow-sm sm:p-10">
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-mint/15 blur-3xl" />
          <Sparkles
            className="pointer-events-none absolute right-8 top-7 h-5 w-5 text-gold/70"
            aria-hidden
          />
          <Sparkles
            className="pointer-events-none absolute right-24 top-20 h-3.5 w-3.5 text-primary/50"
            aria-hidden
          />

          <div className="relative max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
              <Dices className="h-3.5 w-3.5 text-gold" aria-hidden />
              TRPG オンラインセッション
            </div>
            <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              卓を立てて、すぐ遊ぶ。
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              盤面・ダイス・キャラシ・BGM が 1 つに。ブラウザならインストール不要。
              参加者はログインして、GM から届いた参加コードを入れるだけです。
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href={"/play" as Route}
                className={cn(buttonVariants({ variant: "primary" }))}
              >
                卓を立てる
              </Link>
              <Link
                href={"/download" as Route}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                アプリをダウンロード
              </Link>
            </div>
          </div>
        </section>

        {/* ===== 最近の卓(ログイン中のみ) ===== */}
        {recent.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-lg font-semibold tracking-tight">
                最近の卓
              </h2>
              <Link
                href={"/library" as Route}
                className="text-xs text-muted-foreground transition hover:text-foreground"
              >
                ライブラリですべて見る →
              </Link>
            </div>
            <ul className="grid gap-3 sm:grid-cols-3">
              {recent.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/play/${s.id}` as Route}
                    className="block rounded-lg border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
                  >
                    <p className="truncate font-semibold">{s.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.systemLabel ?? "システム未設定"} · 駒 {s.panelCount}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {new Intl.DateTimeFormat("ja-JP", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(s.updatedAt))}{" "}
                      更新
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ===== できること ===== */}
        <section className="space-y-3">
          <h2 className="font-serif text-lg font-semibold tracking-tight">
            できること
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <Link
                  href={f.href}
                  className="group flex h-full gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary-soft text-primary transition-transform duration-300 group-hover:scale-110">
                    <f.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 space-y-1">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">{f.title}</span>
                      {f.appOnly && (
                        <span className="rounded-full border border-border px-1.5 py-px text-[10px] text-muted-foreground">
                          アプリ
                        </span>
                      )}
                    </span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">
                      {f.body}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <AppDownloadCta />
      </PageContainer>
    </>
  );
}
