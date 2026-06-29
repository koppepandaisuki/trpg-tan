import { notFound } from "next/navigation";
import type { Metadata, Route } from "next";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import {
  getEventByPublicToken,
  getEventByAdminToken,
} from "@/lib/queries/schedule";
import { ScheduleEventView } from "@/components/schedule/event-view";

// トークン依存・投票で内容が変わるためキャッシュしない。
export const dynamic = "force-dynamic";

interface PageProps {
  params: { token: string };
  searchParams: { admin?: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const event = await getEventByPublicToken(params.token);
  return {
    title: event ? `${event.title}｜日程調整` : "日程調整",
    description:
      "TRPGセッションの日程調整。ログイン不要で ○ △ × の出欠を入れられます。",
    robots: { index: false },
  };
}

/**
 * /schedule/[token] — 日程調整イベントの閲覧・投票。
 * `?admin=<管理トークン>` が同じイベントの管理トークンと一致するときだけ、
 * 主催メニュー(確定・編集・削除)を出す。
 */
export default async function ScheduleEventPage({
  params,
  searchParams,
}: PageProps) {
  const event = await getEventByPublicToken(params.token);
  if (!event) notFound();

  let adminToken: string | null = null;
  if (searchParams.admin) {
    const byAdmin = await getEventByAdminToken(searchParams.admin);
    if (byAdmin && byAdmin.id === event.id) adminToken = searchParams.admin;
  }

  return (
    <>
      <TopHeader />
      <PageContainer>
        <Breadcrumb
          items={[
            { label: "日程調整", href: "/schedule/new" as Route },
            { label: event.title },
          ]}
        />
        <div className="mx-auto max-w-3xl py-6">
          <ScheduleEventView initialEvent={event} adminToken={adminToken} />
        </div>
      </PageContainer>
    </>
  );
}
