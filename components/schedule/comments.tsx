"use client";

import * as React from "react";
import { MessageSquare, Loader2, Send } from "lucide-react";
import type { ScheduleEventPublic } from "@/lib/schedule/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fmtDateTime } from "./format";
import { getRememberedName, rememberName } from "./local";

export function ScheduleComments({
  event,
  onChanged,
}: {
  event: ScheduleEventPublic;
  onChanged: () => void;
}) {
  const [name, setName] = React.useState("");
  const [text, setText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setName(getRememberedName());
  }, []);

  async function submit() {
    setError(null);
    if (!name.trim() || !text.trim()) {
      setError("名前とコメントを入力してください");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/schedule/events/${event.publicToken}/comment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), text: text.trim() }),
        },
      );
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "送信に失敗しました");
        setSubmitting(false);
        return;
      }
      rememberName(name.trim());
      setText("");
      setSubmitting(false);
      onChanged();
    } catch {
      setError("通信に失敗しました");
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        コメント（{event.comments.length}）
      </h2>

      {event.comments.length > 0 && (
        <ul className="space-y-2">
          {event.comments.map((c) => (
            <li
              key={c.id}
              className="rounded-md border border-border bg-card px-3 py-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {fmtDateTime(c.createdAt)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                {c.text}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 rounded-md border border-border p-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="名前"
          className="h-9 w-40"
          maxLength={60}
        />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="「この日は20時からなら」など"
          rows={2}
          maxLength={2000}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={submit} disabled={submitting} size="sm">
          {submitting ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-1 h-4 w-4" />
          )}
          コメントする
        </Button>
      </div>
    </section>
  );
}
