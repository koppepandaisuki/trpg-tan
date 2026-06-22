"use client";

import * as React from "react";
import { CalendarCheck, Clock, FileText } from "lucide-react";
import type { ScheduleEventPublic } from "@/lib/schedule/types";
import { VoteTable } from "./vote-table";
import { ScheduleComments } from "./comments";
import { ShareBox } from "./share-box";
import { ManagePanel } from "./manage-panel";
import { FriendInvitePanel } from "./friend-invite-panel";
import { fmtDate, fmtTime, fmtDateTime } from "./format";

/**
 * 日程調整イベント画面の取りまとめ(クライアント)。
 * イベントを state に持ち、投票/コメント/管理の後に GET で再取得して反映する。
 * adminToken があるとき(主催が管理URLで開いているとき)だけ主催メニューを出す。
 */
export function ScheduleEventView({
  initialEvent,
  adminToken,
}: {
  initialEvent: ScheduleEventPublic;
  adminToken: string | null;
}) {
  const [event, setEvent] = React.useState(initialEvent);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/schedule/events/${event.publicToken}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok: boolean;
        event?: ScheduleEventPublic;
      };
      if (res.ok && data.ok && data.event) setEvent(data.event);
    } catch {
      // 一時的な失敗は無視(次の操作で再取得される)。
    }
  }, [event.publicToken]);

  const finalizedSlot = event.finalizedSlotId
    ? event.slots.find((s) => s.id === event.finalizedSlotId)
    : null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{event.title}</h1>
        {event.scenarioRef?.title && (
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            シナリオ: {event.scenarioRef.title}
          </p>
        )}
        {event.memo && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {event.memo}
          </p>
        )}
        {event.deadline && (
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            締切: {fmtDateTime(event.deadline)}
          </p>
        )}
      </header>

      {finalizedSlot && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3">
          <CalendarCheck className="h-5 w-5 text-primary" />
          <div className="text-sm">
            <span className="text-muted-foreground">開催日が確定しました：</span>
            <span className="ml-1 font-semibold">
              {fmtDate(finalizedSlot.startsAt)} {fmtTime(finalizedSlot.startsAt)}
            </span>
          </div>
        </div>
      )}

      <ShareBox publicToken={event.publicToken} adminToken={adminToken} />

      {adminToken && (
        <FriendInvitePanel
          adminToken={adminToken}
          publicToken={event.publicToken}
          slots={event.slots.map((s) => ({ id: s.id, startsAt: s.startsAt }))}
        />
      )}

      <VoteTable event={event} onChanged={refresh} />

      {adminToken && (
        <ManagePanel
          event={event}
          adminToken={adminToken}
          onChanged={refresh}
        />
      )}

      <ScheduleComments event={event} onChanged={refresh} />
    </div>
  );
}
