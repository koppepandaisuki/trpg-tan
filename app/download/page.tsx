import Link from "next/link";
import type { Route } from "next";
import {
  Download,
  Dices,
  PackageOpen,
  Users,
  RefreshCw,
  ShieldCheck,
  Monitor,
} from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "アプリをダウンロード",
  description:
    "Re-dice デスクトップアプリ（Windows）のダウンロード。買った作品をそのまま卓へ。オンラインセッション・シナリオ作成・キャラクターシートが使えます。",
};

/** GitHub Releases の最新版ページ。最新の setup.exe をここから取得する。 */
const RELEASES_LATEST =
  "https://github.com/koppepandaisuki/trpg-tan/releases/latest";

const FEATURES = [
  {
    icon: Dices,
    title: "オンラインで卓を囲む",
    desc: "盤面・コマ・ダイス・BGM・カットインでセッションを進行。参加コードで仲間を招待。",
  },
  {
    icon: PackageOpen,
    title: "買った作品をそのまま遊ぶ",
    desc: "ストアで買ったシナリオ・システムをワンクリックで取り込み、すぐ卓へ。",
  },
  {
    icon: Users,
    title: "作って出品まで",
    desc: "ノーコードのビルダーでシステム・シナリオを作成し、アプリから出品できます。",
  },
];

const STEPS = [
  "「ダウンロード」から setup.exe を保存して実行します。",
  "インストール後アプリを起動します。",
  "「ログイン」を押すとブラウザが開きます。メール / Google でログインすると、自動でアプリにも反映されます。",
];

export default function DownloadPage() {
  return (
    <>
      <TopHeader />
      <PageContainer className="py-10">
        <Breadcrumb items={[{ label: "アプリをダウンロード" }]} />

        {/* Hero */}
        <Card className="mt-4 overflow-hidden border-border bg-gradient-to-br from-sky-500/10 via-transparent to-emerald-500/10">
          <CardContent className="relative space-y-5 py-8 text-center">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-300 bg-sky-50 text-sky-700">
              <Dices className="h-7 w-7" aria-hidden />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">
                Re-dice デスクトップアプリ
              </h1>
              <p className="text-sm text-muted-foreground">
                買ったらそのまま卓へ。オンラインセッション・シナリオ作成・
                キャラクターシートが 1 つに。
              </p>
            </div>

            <div className="flex flex-col items-center gap-2">
              <a
                href={RELEASES_LATEST}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "primary", size: "lg" }),
                  "gap-2",
                )}
              >
                <Download className="h-5 w-5" aria-hidden />
                Windows 版をダウンロード
              </a>
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Monitor className="h-3.5 w-3.5" aria-hidden />
                Windows 10 / 11（64bit）・無料
              </p>
            </div>
          </CardContent>
        </Card>

        {/* できること */}
        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="border-border">
              <CardContent className="space-y-2 py-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700">
                  <f.icon className="h-4 w-4" aria-hidden />
                </div>
                <h2 className="text-sm font-semibold tracking-tight">
                  {f.title}
                </h2>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* インストール手順 */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            インストール手順
          </h2>
          <ol className="space-y-3">
            {STEPS.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-sm text-foreground/90">{s}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* 補足 */}
        <section className="mt-8 grid gap-3 sm:grid-cols-2">
          <Card className="border-border">
            <CardContent className="flex items-start gap-3 py-4">
              <RefreshCw
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                aria-hidden
              />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">自動アップデート</p>
                <p className="text-xs text-muted-foreground">
                  起動時に最新版を確認して自動で更新します。常に最新の状態で
                  遊べます。
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="flex items-start gap-3 py-4">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-sky-600"
                aria-hidden
              />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  インストール時の警告について
                </p>
                <p className="text-xs text-muted-foreground">
                  個人開発のため、初回起動で Windows
                  の警告が出る場合があります。「詳細情報」→「実行」で進めてください。
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          うまくいかないときは{" "}
          <Link
            href={"/help" as Route}
            className="text-accent underline-offset-4 hover:underline"
          >
            ヘルプ
          </Link>{" "}
          をご覧ください。macOS 版は今後対応予定です。
        </p>
      </PageContainer>
    </>
  );
}
