import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { PlayGuest } from "@/components/play/play-guest";
import { getCurrentUser } from "@/lib/session/get-user";

export const metadata = { title: "卓に参加 | PLAY" };

/**
 * 参加コードで卓に入る(参加者ビュー)。
 *
 * 卓データは GM から(P2P 直結 or 中継で)受け取るので DB は触らない。
 * **ログインは不要**(参加コードと表示名だけで入れる。ココフォリアと同じ手軽さ)。
 * ログインしていれば、キャラシで保存した自分のキャラを駒として出せる。
 */
export default async function PlayJoinPage({
  params,
}: {
  params: { code: string };
}) {
  const user = await getCurrentUser();
  const code = decodeURIComponent(params.code).toUpperCase().slice(0, 8);

  return (
    <>
      <TopHeader />
      <PageContainer className="py-4">
        <PlayGuest code={code} signedIn={!!user} />
      </PageContainer>
    </>
  );
}
