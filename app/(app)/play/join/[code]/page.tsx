import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { PlayGuest } from "@/components/play/play-guest";
import { requireUser } from "@/lib/session/require";

export const metadata = { title: "卓に参加 | PLAY" };

/**
 * 参加コードで卓に入る(参加者ビュー)。
 *
 * 卓データは GM から Realtime で受け取るので DB は触らない。
 * ログインは必須(誰が参加しているかを表示名で扱うため)。
 */
export default async function PlayJoinPage({
  params,
}: {
  params: { code: string };
}) {
  await requireUser();
  const code = decodeURIComponent(params.code).toUpperCase().slice(0, 8);

  return (
    <>
      <TopHeader />
      <PageContainer className="py-4">
        <PlayGuest code={code} />
      </PageContainer>
    </>
  );
}
