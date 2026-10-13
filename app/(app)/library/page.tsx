import { FolderOpen } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { LibraryView } from "@/components/library/library-view";
import { requireUser } from "@/lib/session/require";
import { listMyPlaySessions } from "@/lib/queries/play-sessions";
import { listMyPlayAssets } from "@/lib/queries/play-assets";
import { AdArea } from "@/components/ads/ad-area";

export const metadata = {
  title: "ライブラリ",
  description: "自分の卓と、背景・駒・BGM などの素材の保管庫。",
};

/**
 * ライブラリ = 自分の卓 + 素材(画像・音声)の保管庫。
 *
 * 2026-09 のストア廃止までは「購入した作品」の一覧だったが、作品売買を
 * やめたので「自分のゲームを保存しておく場所」に再定義した。
 *   - 卓   : play_sessions(0048)。PLAY で立てた卓がそのまま並ぶ
 *   - 素材 : play_assets(0049)。卓でアップロードした画像・音声も自動で並ぶ
 */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const user = await requireUser();
  const [sessions, assets] = await Promise.all([
    listMyPlaySessions(user.id),
    listMyPlayAssets(user.id),
  ]);

  return (
    <>
      <TopHeader />
      <PageContainer className="space-y-6 py-8">
        <Card className="overflow-hidden border-border bg-gradient-to-br from-red-500/8 via-transparent to-amber-500/8 shadow-sm">
          <CardContent className="relative py-6 sm:py-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
            <div className="relative z-10 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-700">
                <FolderOpen className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h1 className="font-serif text-2xl font-semibold tracking-tight">
                  ライブラリ
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  卓 {sessions.length} ・ 素材 {assets.assets.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <LibraryView
          sessions={sessions}
          assets={assets.assets}
          assetsReady={assets.ok}
          initialTab={searchParams.tab === "assets" ? "assets" : "tables"}
        />
        <AdArea />
      </PageContainer>
    </>
  );
}
