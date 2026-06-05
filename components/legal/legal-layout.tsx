import type { LucideIcon } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";

/**
 * 利用規約 / プライバシーポリシー / 特商法ページ共通のレイアウト。
 * hero ヘッダー + Breadcrumb + prose 風の本文カード。
 *
 * α 期間中の内容は「暫定版」である旨を上部に明示する。Phase 2 で
 * 弁護士レビューを経た正式版に差し替える想定。
 *
 * Server Component(状態なし)。
 */
export function LegalLayout({
  title,
  icon: Icon,
  lastUpdated,
  children,
}: {
  title: string;
  icon: LucideIcon;
  /** 「2026-06-05」のような最終更新日 */
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <TopHeader />
      <PageContainer className="space-y-6 py-8">
        <Breadcrumb items={[{ label: title, icon: Icon }]} />

        {/* Hero */}
        <Card className="overflow-hidden border-border bg-gradient-to-br from-slate-500/8 via-transparent to-slate-500/5 shadow-sm">
          <CardContent className="relative py-6 sm:py-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-slate-500/10 blur-3xl" />
            <div className="relative z-10 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-slate-700">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <div className="flex-1 space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {title}
                </h1>
                <p className="text-xs text-muted-foreground">
                  最終更新日: {lastUpdated}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* α 期間中の暫定版注記 */}
        <div className="rounded-md border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs leading-relaxed text-amber-900">
          本ページは α テスト期間中の暫定版です。正式リリース時に内容を改定する
          場合があります。重要な変更がある場合は Discord 等でお知らせします。
        </div>

        {/* 本文 */}
        <Card className="shadow-sm">
          <CardContent className="prose-legal space-y-6 py-7 text-sm leading-relaxed text-foreground/90">
            {children}
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}

/**
 * 法的ページ内のセクション(見出し + 本文)。番号付きで読みやすく。
 */
export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        {heading}
      </h2>
      <div className="space-y-2 text-muted-foreground">{children}</div>
    </section>
  );
}
