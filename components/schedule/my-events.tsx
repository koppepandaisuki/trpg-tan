"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { CalendarClock, Settings2 } from "lucide-react";
import { getMyEvents, type SavedEvent } from "./local";

/**
 * このブラウザで作成した日程調整イベントの一覧(localStorage)。
 * 主催が管理用URL(admin_token 付き)を後から開けるようにする。
 */
export function ScheduleMyEvents() {
  const [events, setEvents] = React.useState<SavedEvent[]>([]);

  React.useEffect(() => {
    setEvents(getMyEvents());
  }, []);

  if (events.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
        このブラウザで作成したイベント
      </h2>
      <ul className="space-y-2">
        {events.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
          >
            <Link
              href={`/schedule/${e.publicToken}` as Route}
              className="flex min-w-0 items-center gap-2 text-sm hover:text-primary"
            >
              <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{e.title}</span>
            </Link>
            <Link
              href={`/schedule/${e.publicToken}?admin=${e.adminToken}` as Route}
              className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" />
              管理
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
