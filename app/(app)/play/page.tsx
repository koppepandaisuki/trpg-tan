import { Dices } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { PlayLobby } from "@/components/play/play-lobby";
import { requireUser } from "@/lib/session/require";
import { listMyPlaySessions } from "@/lib/queries/play-sessions";

export const metadata = {
  title: "PLAY",
  description:
    "ブラウザでそのまま卓を立てて遊べます。盤面・駒・ダイス・チャットをリアルタイムで共有。",
};

/**
 * PLAY ロビー(Web 版)。
 *
 * デスクトップ版と同じ「GM 権威のリアルタイム卓」をブラウザで動かす入口。
 * 卓の実体は play_sessions(migration 0048)に保存し、参加者とは Supabase
 * Realtime の broadcast(@trpg/core の共有プロトコル)で同期する。
 */
export default async function PlayLobbyPage() {
  const user = await requireUser();
  const sessions = await listMyPlaySessions(user.id);

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
                <Dices className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">PLAY</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  ブラウザでそのまま卓を立てて遊べます。参加コードを共有すれば、
                  相手はアプリのインストール不要で参加できます。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <PlayLobby sessions={sessions} />
      </PageContainer>
    </>
  );
}
