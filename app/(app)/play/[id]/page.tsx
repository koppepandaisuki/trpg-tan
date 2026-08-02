import { notFound } from "next/navigation";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { PlayTable } from "@/components/play/play-table";
import { requireUser } from "@/lib/session/require";
import { getMyPlayScene } from "@/lib/queries/play-sessions";

export const metadata = { title: "卓 | PLAY" };

/**
 * 卓本体(GM ビュー)。自分の卓だけ開ける(RLS + owner 一致)。
 * 以降の状態更新はすべてクライアント側(PlayTable)で行い、
 * play_sessions へオートセーブする。
 */
export default async function PlayTablePage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const scene = await getMyPlayScene(user.id, params.id);
  if (!scene) notFound();

  return (
    <>
      <TopHeader />
      <PageContainer className="py-4">
        <PlayTable initialScene={scene} />
      </PageContainer>
    </>
  );
}
