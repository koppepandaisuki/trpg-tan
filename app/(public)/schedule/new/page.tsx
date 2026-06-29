import { CalendarClock } from "lucide-react";
import { TopHeader } from "@/components/layout/top-header";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ScheduleCreateForm } from "@/components/schedule/create-form";
import { ScheduleMyEvents } from "@/components/schedule/my-events";

export const metadata = {
  title: "日程調整をつくる",
  description:
    "TRPGセッションの日程調整。候補日を並べてURLを共有するだけ。参加者はログイン不要で○△×を入れられます。",
};

/**
 * /schedule/new — 日程調整イベントの作成。
 * 主催は web/アプリどちらからでも作れる(ここは web 入口)。作成後は共有URLと
 * 管理URLが発行され、参加者はログイン不要で投票できる。
 */
export default function ScheduleNewPage() {
  return (
    <>
      <TopHeader />
      <PageContainer>
        <Breadcrumb items={[{ label: "日程調整" }]} />
        <div className="mx-auto max-w-2xl py-6">
          <header className="mb-6">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <CalendarClock className="h-6 w-6 text-primary" />
              日程調整をつくる
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              候補日を並べて、できたURLを参加者に配るだけ。参加者は
              <span className="font-medium text-foreground">
                ログイン不要
              </span>
              で ○ △ × を入れられます。
            </p>
          </header>

          <ScheduleCreateForm />

          <div className="mt-10">
            <ScheduleMyEvents />
          </div>
        </div>
      </PageContainer>
    </>
  );
}
