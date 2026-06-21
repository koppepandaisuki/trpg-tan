import Link from "next/link";
import {
  CheckCircle2,
  Download,
  Gamepad2,
  Star,
  type LucideIcon,
} from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ReturnToDesktop } from "@/components/checkout/return-to-desktop";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "ご購入手続きを受け付けました",
};

interface PageProps {
  searchParams: { session_id?: string; return_to?: string };
}

/**
 * Checkout success page.
 *
 * The session_id query is accepted for tracing only. The page does NOT
 * use it to confirm anything against the DB — webhook is the single source
 * of truth, and reflection into the library may lag by a few seconds.
 *
 * 見た目は HomeHero / EmptyState と統一(グラデ + 円形アイコン)。
 * 成功画面は emerald トーンで positive 強調。
 */
export default function CheckoutSuccessPage({ searchParams }: PageProps) {
  if (process.env.NODE_ENV !== "production" && searchParams.session_id) {
    // Development-only trace. Not surfaced to the user.
    console.info("[checkout/success] session_id", searchParams.session_id);
  }
  const isDesktopReturn = searchParams.return_to === "desktop";

  return (
    <>
      <TopHeader />
      <PageContainer className="py-16">
        <Card className="mx-auto max-w-md overflow-hidden border-border bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-500/5 shadow-sm">
          <CardContent className="relative flex flex-col items-center gap-5 py-12 text-center">
            {/* 装飾ブラー */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" aria-hidden />
            </div>

            <div className="relative z-10 space-y-2">
              <h1 className="text-xl font-semibold tracking-tight">
                ご購入手続きを受け付けました
              </h1>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                決済結果を確認しています。購入内容はまもなくライブラリに反映されます。
                通常は数秒で反映されますが、まれに少し時間がかかることがあります。
              </p>
            </div>

            {/* プレイ後レビューの導線(VVVVV)。購入直後にレビューを促すのではなく、
                ダウンロード → 実際にプレイ → プレイ後に感想、という TRPG 本来の
                流れを 3 ステップで示す。レビューはあくまで「遊んだ後」のもの。 */}
            <div className="relative z-10 w-full rounded-lg border border-border bg-background/70 p-4 text-left sm:max-w-xs">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                次のステップ
              </p>
              <ol className="space-y-3">
                <NextStep
                  n={1}
                  icon={Download}
                  text="ライブラリから作品をダウンロード"
                />
                <NextStep n={2} icon={Gamepad2} text="セッションで実際にプレイ" />
                <NextStep
                  n={3}
                  icon={Star}
                  text="プレイ後、作品ページで感想をレビュー"
                />
              </ol>
            </div>

            {isDesktopReturn ? (
              <ReturnToDesktop
                kind="complete"
                sessionId={searchParams.session_id}
              />
            ) : (
              <div className="relative z-10 flex w-full flex-col gap-2 pt-2 sm:max-w-xs">
                <Link
                  href="/library"
                  className={cn(buttonVariants({ variant: "primary" }))}
                >
                  ライブラリを開く
                </Link>
                <Link
                  href="/store"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  ストアへ戻る
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}

/**
 * 「次のステップ」リストの 1 項目。番号バッジ + アイコン + テキスト。
 * 購入完了 → DL → プレイ → レビュー という流れを視覚化する。
 */
function NextStep({
  n,
  icon: Icon,
  text,
}: {
  n: number;
  icon: LucideIcon;
  text: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-[11px] font-bold text-emerald-700">
        {n}
      </span>
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-xs text-foreground/90">{text}</span>
    </li>
  );
}
