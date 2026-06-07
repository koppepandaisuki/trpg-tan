import type { Metadata } from "next";
import { Users } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { requireUser } from "@/lib/session/require";
import { listFriends, getMyInviteToken } from "@/lib/queries/friends";
import { FriendList } from "@/components/friends/friend-list";
import { InviteLinkBox } from "@/components/friends/invite-link-box";

export const metadata: Metadata = { title: "フレンド" };
export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  await requireUser();
  const [friends, token] = await Promise.all([
    listFriends(),
    getMyInviteToken(),
  ]);

  return (
    <>
      <TopHeader />
      <PageContainer className="max-w-2xl space-y-6 py-8">
        <Breadcrumb items={[{ label: "フレンド", icon: Users }]} />

        <header className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            <Users className="h-6 w-6 text-primary" aria-hidden /> フレンド
          </h1>
          <p className="text-sm text-muted-foreground">
            招待リンクを送るだけでフレンドに。オンライン状況も確認できます。
          </p>
        </header>

        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">フレンドを招待</h2>
          <InviteLinkBox initialToken={token} />
        </section>

        <FriendList friends={friends} />
      </PageContainer>
    </>
  );
}
