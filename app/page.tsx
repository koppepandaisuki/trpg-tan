import Link from "next/link";
import type { Route } from "next";
import {
  BookOpenText,
  Dices,
  Gift,
  Link2,
  Lock,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { AppDownloadCta } from "@/components/home/app-download-cta";
import { ProductShots } from "@/components/home/product-shots";
import { JoinCodeForm } from "@/components/play/join-code-form";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session/get-user";
import { listMyPlaySessions } from "@/lib/queries/play-sessions";
import { cn } from "@/lib/utils";

/**
 * トップページ。
 *
 * 2026-09 にストア(作品売買)を廃止し、Re-dice は「卓を立てて遊ぶ道具」に
 * 絞った。トップの入口は 2 つだけ: GM の「卓を立てる」と、参加者の参加コード。
 * ほかの道具(ライブラリ・キャラシ・日程調整…)はヘッダーから辿る。
 *
 * ログイン中は自分の卓を最近のものから出して、すぐ再開できるようにする。
 */

// root layout の title.default に任せる(「Re-dice TRPGサイト」)。

/** Re-dice の強み(他のセッションツールと比べたときの違い)。 */
const STRENGTHS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Gift,
    title: "卓を立てるのも無料",
    body: "ホストも参加も無料。卓の複製・書き出し・タイマーも追加料金なしで使えます。",
  },
  {
    icon: Link2,
    title: "参加はリンクを開くだけ",
    body: "参加者はログインもインストールも不要。招待リンクを開いて名前を入れるだけ。",
  },
  {
    icon: Dices,
    title: "280 以上のシステムのダイス",
    body: "定番のダイスボット BCDice に対応。CoC・ソード・ワールド・ネクロニカ…そのまま振れます。",
  },
  {
    icon: Zap,
    title: "GM と直結で軽快",
    body: "GM と参加者の端末を直接つなぐので、駒の移動もチャットもすぐ届きます。",
  },
  {
    icon: Lock,
    title: "秘密はちゃんと秘密に",
    body: "シークレットダイスの出目・個別チャット・ハンドアウトは、宛先の人だけが読める形で届きます。",
  },
  {
    icon: BookOpenText,
    title: "シナリオから卓まで一続き",
    body: "キャラシ作成・日程調整・「TRPGシナリオ工房」で書いたシナリオの取り込みまで、ここ 1 つで。",
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const recent = user ? (await listMyPlaySessions(user.id)).slice(0, 3) : [];

  return (
    <>
      <TopHeader />
      <PageContainer className="space-y-10 py-8">
        {/* ===== Hero =====
            墨の面 + 紅の光(Netflix 型)。◆ はロゴの「dicere」の両脇の菱形。 */}
        <section className="relative isolate overflow-hidden rounded-2xl bg-ink px-6 py-12 text-white shadow-lg sm:px-12 sm:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-32 -z-10 h-[30rem] w-[30rem] rounded-full bg-primary/75 blur-[120px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]"
          />

          <div className="relative grid grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="max-w-2xl space-y-5">
              <p className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.25em] text-white/60">
                <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-primary" />
                TRPG ONLINE SESSION
              </p>
              <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                卓を立てて、<span className="whitespace-nowrap">すぐ遊ぶ。</span>
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
                盤面・ダイス・キャラシ・BGM が 1 つに。卓を立てるのも参加するのも無料。
                参加者はログインもインストールも不要で、GM から届いたリンクを開くだけです。
              </p>
              {/* 入口は 2 つだけ: GM は「卓を立てる」(1 回押せば新しい卓が開く)、
                  参加者は参加コード。ログインしていなければ、ログイン後にそのまま卓が開く。 */}
              <div className="max-w-md space-y-3 pt-2">
                <Link
                  href={
                    (user
                      ? "/play?new=1"
                      : `/login?next=${encodeURIComponent("/play?new=1")}`) as Route
                  }
                  className={cn(
                    buttonVariants({ variant: "primary", size: "lg" }),
                    "w-full sm:w-auto",
                  )}
                >
                  <Dices aria-hidden />
                  卓を立てる(GM・無料)
                </Link>
                <div className="flex items-center gap-3 pt-1 text-[11px] text-white/55">
                  <span aria-hidden className="h-px flex-1 bg-white/15" />
                  参加者はこちら
                  <span aria-hidden className="h-px flex-1 bg-white/15" />
                </div>
                <JoinCodeForm variant="hero" />
              </div>
            </div>

            {/* 実際の画面: GM の卓 + 参加者のスマホ */}
            <ProductShots priority />
          </div>
        </section>

        {/* ===== 最近の卓(ログイン中のみ) ===== */}
        {recent.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold tracking-tight">最近の卓</h2>
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

        {/* ===== Re-dice の強み ===== */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight">Re-dice が選ばれる理由</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STRENGTHS.map((s) => (
              <li
                key={s.title}
                className="flex gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <s.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 space-y-1">
                  <span className="block font-semibold">{s.title}</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    {s.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <AppDownloadCta />
      </PageContainer>
    </>
  );
}
