import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { User } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/session/get-user";
import { getFriendInviteInfo } from "@/lib/queries/friends";
import { publicAvatarUrl } from "@/lib/format/storage";
import { AcceptInviteButton } from "@/components/friends/accept-invite-button";

export const metadata: Metadata = { title: "フレンド招待" };
export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const info = await getFriendInviteInfo(params.token);
  if (!info) notFound();

  const user = await getCurrentUser();
  const avatar = publicAvatarUrl(info.avatarPath);
  const isSelf = user?.id === info.inviterId;

  return (
    <>
      <TopHeader />
      <PageContainer className="max-w-md py-12">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="relative h-20 w-20 overflow-hidden rounded-full bg-muted">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <User className="h-8 w-8" aria-hidden />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-lg font-bold">
              {info.displayName || "(名称未設定)"} さん
            </p>
            <p className="text-sm text-muted-foreground">
              があなたをフレンドに招待しています。
            </p>
          </div>

          <div className="w-full">
            {isSelf ? (
              <p className="text-sm text-muted-foreground">
                これはあなた自身の招待リンクです。フレンドに共有してください。
              </p>
            ) : user ? (
              <AcceptInviteButton token={params.token} />
            ) : (
              <Link
                href={
                  `/login?next=${encodeURIComponent(`/friends/invite/${params.token}`)}` as Route
                }
                className={cn(buttonVariants(), "w-full")}
              >
                ログインして承認
              </Link>
            )}
          </div>

          <Link
            href={"/friends" as Route}
            className="text-xs text-muted-foreground underline transition hover:text-foreground"
          >
            フレンド一覧へ
          </Link>
        </div>
      </PageContainer>
    </>
  );
}
