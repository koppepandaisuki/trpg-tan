"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { BrandMark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";

/**
 * App Router の Error Boundary。レンダリング / Server Action 中に
 * unhandled な例外が起きたときに表示される。
 *
 * 重要な制約:
 *   本ファイルは "use client" Component なので、Server Component や
 *   "server-only" モジュールに依存するもの(例: TopHeader → getCurrentUser →
 *   lib/session/get-user.ts)を import できない。
 *   そのため、簡素なブランドだけの mini header を本ファイル内に直書き。
 *
 * 見た目は他の状態画面(404 / 403 / success / cancel)と統一した
 * グラデ + 円形アイコンのカード型レイアウト。
 *
 * トーンマッピング:
 *  - 404 (not-found)  → slate  / Compass    (迷子)
 *  - 403 (forbidden)  → rose   / ShieldAlert(拒否)
 *  - error.tsx (本ファ) → amber  / AlertTriangle(警告、想定外)
 *  - global-error.tsx → rose   / XOctagon   (root レベルの致命)
 *
 * `reset()` は Next.js が渡してくる「同じ階層をもう一度マウントしなおす」
 * 関数。失敗した Server Action や fetch の retry に使える。
 *
 * `error.digest` は本番ビルド時のサーバーログとの突合用 ID。テスター
 * からの報告で「digest 〇〇 のエラーです」と伝えられると追跡しやすい。
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // production の Next.js は console.error 経由でしか手元に出ないため
    // 開発時に何が起きたか速やかに分かるよう明示的に流す。
    // eslint-disable-next-line no-console
    console.error("[error.tsx] caught:", error);
  }, [error]);

  return (
    <>
      <MiniHeader />
      <PageContainer className="py-16">
        <Card className="mx-auto max-w-md overflow-hidden border-border bg-gradient-to-br from-amber-500/10 via-transparent to-amber-500/5 shadow-sm">
          <CardContent className="relative flex flex-col items-center gap-5 py-12 text-center">
            {/* 装飾ブラー(他の状態画面と統一) */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />

            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-700">
              <AlertTriangle className="h-8 w-8" aria-hidden />
            </div>

            <div className="relative z-10 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Something went wrong
              </p>
              <h1 className="text-xl font-semibold tracking-tight">
                予期しないエラーが発生しました
              </h1>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                処理中に問題が発生しました。少し時間をおいてから、もう一度お試しください。
                繰り返し発生する場合は Discord でご連絡ください。
              </p>
              {error.digest && (
                <p className="pt-2 text-[11px] font-mono text-muted-foreground">
                  digest: {error.digest}
                </p>
              )}
            </div>

            <div className="relative z-10 flex w-full flex-col gap-2 pt-2 sm:max-w-xs">
              <Button
                type="button"
                variant="primary"
                onClick={() => reset()}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4" />
                もう一度試す
              </Button>
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                トップへ戻る
              </Link>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}

/**
 * Client-safe な簡素なヘッダー。
 *
 * TopHeader は Server Component で getCurrentUser → server-only に
 * 依存するため、Client Component の error.tsx からは import できない。
 * エラー画面ではフル機能の header は不要なので、ロゴ + トップへ戻る
 * リンクだけの最小構成を本ファイル内に直書きする。
 *
 * BrandMark はサーバー依存がないので Client Component からも import 可。
 */
function MiniHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-center px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center"
          aria-label="Re-dice TRPGサイト ホーム"
        >
          <BrandMark size="md" />
        </Link>
      </div>
    </header>
  );
}
