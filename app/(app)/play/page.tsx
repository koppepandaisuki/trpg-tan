import { Dices } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { PlayLobby } from "@/components/play/play-lobby";
import { AdArea } from "@/components/ads/ad-area";
import { getCurrentUser } from "@/lib/session/get-user";
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
export default async function PlayLobbyPage({ searchParams }: { searchParams: { new?: string } }) {
  // ロビーはログイン不要(参加コードでの参加は誰でもできる)。卓を立てる・
  // 自分の卓を開くときだけログインへ誘導する。
  const user = await getCurrentUser();
  const sessions = user ? await listMyPlaySessions(user.id) : [];

  return (
    <>
      <TopHeader />
      <PageContainer className="space-y-6 py-8">
        <header className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Dices className="h-6 w-6 text-primary" aria-hidden />
            PLAY
          </h1>
          <p className="text-sm text-muted-foreground">
            ブラウザでそのまま遊べます。参加者はログインもインストールも不要です。
          </p>
        </header>

        <PlayLobby sessions={sessions} signedIn={!!user} autoCreate={searchParams.new === "1"} />
        <AdArea />
      </PageContainer>
    </>
  );
}
