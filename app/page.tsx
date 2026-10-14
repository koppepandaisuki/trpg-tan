import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import {
  BookOpenText,
  CalendarDays,
  Dices,
  FolderOpen,
  Gift,
  Hammer,
  Link2,
  Lock,
  ScrollText,
  Users,
  Zap,
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
    body: "ブラウザで卓を立てて、招待リンクを渡すだけでセッション開始。盤面・ダイス・BGM・カットイン・タイマーまで。",
  },
  {
    href: "/library" as Route,
    icon: FolderOpen,
    title: "ライブラリ",
    body: "立てた卓と、背景・駒・BGM などの素材をまとめて保管。次のセッションでそのまま使えます。",
  },
  {
    href: "/characters" as Route,
    icon: ScrollText,
    title: "キャラシ",
    body: "13 システム対応のキャラクターシート。能力値からチャットパレットまで、ブラウザでもアプリと同じエディタで作れます。",
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

          <div className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
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
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href={"/play" as Route}
                  className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
                >
                  <Dices aria-hidden />
                  卓を立てる
                </Link>
                <Link
                  href={"/download" as Route}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "border-white/25 bg-transparent text-white hover:border-white/50 hover:bg-white/10",
                  )}
                >
                  アプリをダウンロード
                </Link>
              </div>
            </div>

            {/* 実際の画面: GM の卓(ウィンドウ枠)+ 参加者のスマホ */}
            <figure className="relative pb-6 sm:pl-10">
              <div className="overflow-hidden rounded-xl bg-[#1c1c1c] shadow-2xl ring-1 ring-white/10">
                <div aria-hidden className="flex h-6 items-center gap-1.5 px-3">
                  <span className="h-2 w-2 rounded-full bg-white/20" />
                  <span className="h-2 w-2 rounded-full bg-white/20" />
                  <span className="h-2 w-2 rounded-full bg-white/20" />
                </div>
                <Image
                  src="/screens/play-gm.png"
                  alt="GM の卓の画面。盤面の上にキャラクターの駒、右にチャットとダイスの結果"
                  width={800}
                  height={500}
                  priority
                  sizes="(min-width: 1024px) 560px, 100vw"
                  className="block h-auto w-full"
                />
              </div>
              <div className="absolute bottom-0 left-0 hidden w-[27%] overflow-hidden rounded-[22px] border-[5px] border-[#1d1d1d] bg-black shadow-2xl ring-1 ring-white/10 sm:block">
                <Image
                  src="/screens/play-guest.png"
                  alt="参加者のスマホの画面。盤面・チャット・タップで振れる判定"
                  width={750}
                  height={1624}
                  sizes="180px"
                  className="block aspect-[9/17] w-full object-cover object-top"
                />
              </div>
              <figcaption className="sr-only">
                Re-dice の卓の画面(PC の GM とスマホの参加者)
              </figcaption>
            </figure>
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

        {/* ===== できること ===== */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight">できること</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <Link
                  href={f.href}
                  className="group flex h-full gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-colors duration-200 group-hover:bg-primary">
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
