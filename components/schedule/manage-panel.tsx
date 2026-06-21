"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Crown, Trash2, Save, Loader2, ShieldCheck } from "lucide-react";
import type { ScheduleEventPublic } from "@/lib/schedule/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fmtDateTime } from "./format";

/**
 * 主催メニュー(管理トークンを持つ人だけに表示)。
 * 候補の確定 / タイトル・メモの更新 / イベント削除。
 */
export function ManagePanel({
  event,
  adminToken,
  onChanged,
}: {
  event: ScheduleEventPublic;
  adminToken: string;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(event.title);
  const [memo, setMemo] = React.useState(event.memo);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function post(body: unknown): Promise<boolean> {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/schedule/manage/${adminToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "操作に失敗しました");
        setBusy(false);
        return false;
      }
      setBusy(false);
      return true;
    } catch {
      setError("通信に失敗しました");
      setBusy(false);
      return false;
    }
  }

  async function finalize(slotId: string) {
    if (await post({ op: "finalize", slotId: slotId || null })) onChanged();
  }
  async function saveMeta() {
    if (await post({ op: "update", title: title.trim(), memo: memo.trim() }))
      onChanged();
  }
  async function del() {
    if (
      !window.confirm(
        "このイベントを削除します。投票・コメントもすべて消えます。よろしいですか？",
      )
    )
      return;
    if (await post({ op: "delete" })) router.push("/schedule/new" as Route);
  }

  return (
    <section className="space-y-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-700">
        <ShieldCheck className="h-4 w-4" />
        主催メニュー
      </h2>

      {/* 確定 */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Crown className="h-3.5 w-3.5" />
          開催日を確定
        </label>
        <select
          value={event.finalizedSlotId ?? ""}
          onChange={(e) => finalize(e.target.value)}
          disabled={busy}
          className="h-9 w-full max-w-sm rounded-md border border-border bg-card px-2 text-sm"
        >
          <option value="">未確定</option>
          {event.slots.map((s) => (
            <option key={s.id} value={s.id}>
              {fmtDateTime(s.startsAt)}
              {s.label ? `（${s.label}）` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* メタ編集 */}
      <div className="space-y-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="max-w-sm"
        />
        <Textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
          maxLength={4000}
          placeholder="メモ"
        />
        <Button onClick={saveMeta} disabled={busy} size="sm" variant="outline">
          {busy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1 h-4 w-4" />
          )}
          タイトル・メモを保存
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* 削除 */}
      <div className="border-t border-amber-500/30 pt-3">
        <button
          type="button"
          onClick={del}
          disabled={busy}
          className="inline-flex items-center gap-1 text-xs text-destructive hover:underline disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          このイベントを削除
        </button>
      </div>
    </section>
  );
}
