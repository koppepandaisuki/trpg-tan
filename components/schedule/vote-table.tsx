"use client";

import * as React from "react";
import { Crown, Loader2 } from "lucide-react";
import type { ScheduleEventPublic, VoteState } from "@/lib/schedule/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate, fmtTime } from "./format";
import { getVoterKey, getRememberedName, rememberName } from "./local";
import { cn } from "@/lib/utils";

const CYCLE: VoteState[] = ["yes", "maybe", "no"];
const MARK: Record<VoteState, string> = { yes: "○", maybe: "△", no: "×" };
const MARK_CLS: Record<VoteState, string> = {
  yes: "text-emerald-600",
  maybe: "text-amber-500",
  no: "text-muted-foreground/60",
};

interface VoterGroup {
  name: string;
  states: Map<string, VoteState>;
}

export function VoteTable({
  event,
  onChanged,
}: {
  event: ScheduleEventPublic;
  onChanged: () => void;
}) {
  const slots = event.slots;

  const voters = React.useMemo(() => {
    const m = new Map<string, VoterGroup>();
    for (const v of event.votes) {
      if (!m.has(v.voterKey)) m.set(v.voterKey, { name: v.voterName, states: new Map() });
      const g = m.get(v.voterKey)!;
      g.name = v.voterName;
      g.states.set(v.slotId, v.state);
    }
    return m;
  }, [event.votes]);

  // 各候補の集計と「いちばん集まる枠」。
  const tally = React.useMemo(() => {
    const t = new Map<string, { yes: number; maybe: number; no: number }>();
    for (const s of slots) t.set(s.id, { yes: 0, maybe: 0, no: 0 });
    for (const g of voters.values()) {
      for (const s of slots) {
        const st = g.states.get(s.id);
        if (st) t.get(s.id)![st] += 1;
      }
    }
    return t;
  }, [slots, voters]);

  const bestSlotId = React.useMemo(() => {
    let best: string | null = null;
    let bestScore = -1;
    for (const s of slots) {
      const c = tally.get(s.id)!;
      const score = c.yes * 2 + c.maybe;
      if (c.yes + c.maybe > 0 && score > bestScore) {
        bestScore = score;
        best = s.id;
      }
    }
    return best;
  }, [slots, tally]);

  // 自分の行(voter_key)。
  const [myKey, setMyKey] = React.useState("");
  const [name, setName] = React.useState("");
  const [myStates, setMyStates] = React.useState<Record<string, VoteState>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const k = getVoterKey();
    setMyKey(k);
    const mine = event.votes.filter((v) => v.voterKey === k);
    if (mine.length > 0) {
      setName(mine[0].voterName);
      const init: Record<string, VoteState> = {};
      for (const v of mine) init[v.slotId] = v.state;
      setMyStates(init);
    } else {
      setName(getRememberedName());
      setMyStates({});
    }
  }, [event]);

  function cycle(slotId: string) {
    setMyStates((s) => {
      const cur = s[slotId] ?? "no";
      const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
      return { ...s, [slotId]: next };
    });
  }

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("名前を入力してください");
      return;
    }
    const entries = slots.map((s) => ({
      slotId: s.id,
      state: myStates[s.id] ?? ("no" as VoteState),
    }));
    setSubmitting(true);
    try {
      const res = await fetch(`/api/schedule/events/${event.publicToken}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterKey: myKey, voterName: name.trim(), entries }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "保存に失敗しました");
        setSubmitting(false);
        return;
      }
      rememberName(name.trim());
      setSubmitting(false);
      onChanged();
    } catch {
      setError("通信に失敗しました");
      setSubmitting(false);
    }
  }

  // 自分以外の行(表示専用)。自分の行は編集行として下にまとめる。
  const otherKeys = [...voters.keys()].filter((k) => k !== myKey);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium">
                参加者
              </th>
              {slots.map((s) => (
                <th
                  key={s.id}
                  className={cn(
                    "min-w-[5.5rem] px-2 py-2 text-center font-medium",
                    s.id === event.finalizedSlotId && "bg-primary/15",
                    s.id === bestSlotId &&
                      s.id !== event.finalizedSlotId &&
                      "bg-emerald-500/10",
                  )}
                >
                  <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                    {s.id === event.finalizedSlotId && (
                      <Crown className="h-3.5 w-3.5 text-primary" />
                    )}
                    <span>{fmtDate(s.startsAt)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fmtTime(s.startsAt)}
                  </div>
                  {s.label && (
                    <div className="text-[10px] text-muted-foreground">
                      {s.label}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 集計行 */}
            <tr className="border-t border-border bg-card/60 text-xs">
              <td className="sticky left-0 z-10 bg-card/60 px-3 py-1.5 text-muted-foreground">
                集計（○）
              </td>
              {slots.map((s) => {
                const c = tally.get(s.id)!;
                return (
                  <td
                    key={s.id}
                    className={cn(
                      "px-2 py-1.5 text-center",
                      s.id === bestSlotId && "font-semibold text-emerald-600",
                    )}
                  >
                    {c.yes}
                    {c.maybe > 0 && (
                      <span className="text-muted-foreground"> +{c.maybe}△</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* 既存の参加者(表示専用) */}
            {otherKeys.map((k) => {
              const g = voters.get(k)!;
              return (
                <tr key={k} className="border-t border-border">
                  <td className="sticky left-0 z-10 bg-background px-3 py-2">
                    {g.name}
                  </td>
                  {slots.map((s) => {
                    const st = g.states.get(s.id) ?? "no";
                    return (
                      <td
                        key={s.id}
                        className={cn(
                          "px-2 py-2 text-center text-base",
                          MARK_CLS[st],
                        )}
                      >
                        {MARK[st]}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* 自分の入力行 */}
            <tr className="border-t-2 border-primary/40 bg-primary/5">
              <td className="sticky left-0 z-10 bg-primary/5 px-3 py-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="あなたの名前"
                  className="h-8 w-28"
                  maxLength={60}
                />
              </td>
              {slots.map((s) => {
                const st = myStates[s.id] ?? "no";
                return (
                  <td key={s.id} className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => cycle(s.id)}
                      className={cn(
                        "h-8 w-8 rounded-md border border-border text-base transition-colors hover:bg-muted",
                        MARK_CLS[st],
                      )}
                      aria-label={`${fmtDate(s.startsAt)} ${fmtTime(s.startsAt)} を切替`}
                    >
                      {MARK[st]}
                    </button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={submitting} size="sm">
          {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          {voters.has(myKey) ? "回答を更新" : "回答を送信"}
        </Button>
        <span className="text-xs text-muted-foreground">
          記号をクリックで ○ → △ → × と切り替わります
        </span>
      </div>
    </div>
  );
}
