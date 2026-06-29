"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Plus, Trash2, CalendarPlus, LayoutGrid, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { jstDateTimeToIso, jstLocalToIso } from "./format";
import { saveMyEvent } from "./local";
import { cn } from "@/lib/utils";

type Mode = "list" | "grid";
interface ListRow {
  date: string;
  time: string;
  label: string;
}

const GRID_TIME_PRESETS = [
  "10:00",
  "13:00",
  "14:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
];
const SLOTS_MAX = 60;

export function ScheduleCreateForm() {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [mode, setMode] = React.useState<Mode>("list");
  const [memo, setMemo] = React.useState("");
  const [deadline, setDeadline] = React.useState("");

  const [rows, setRows] = React.useState<ListRow[]>([
    { date: "", time: "", label: "" },
  ]);
  const [gridDates, setGridDates] = React.useState<string[]>([""]);
  const [gridTimes, setGridTimes] = React.useState<string[]>([
    "20:00",
    "21:00",
  ]);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function buildSlots(): { startsAt: string; label?: string }[] {
    if (mode === "list") {
      return rows
        .filter((r) => r.date && r.time)
        .map((r) => ({
          startsAt: jstDateTimeToIso(r.date, r.time),
          label: r.label.trim() || undefined,
        }));
    }
    const dates = gridDates.filter(Boolean);
    const times = gridTimes.filter(Boolean);
    const out: { startsAt: string }[] = [];
    for (const d of dates) {
      for (const t of times) out.push({ startsAt: jstDateTimeToIso(d, t) });
    }
    return out;
  }

  const slotCount = buildSlots().length;

  async function submit() {
    setError(null);
    if (!title.trim()) {
      setError("タイトルを入力してください");
      return;
    }
    const slots = buildSlots();
    if (slots.length === 0) {
      setError("候補を1つ以上追加してください");
      return;
    }
    if (slots.length > SLOTS_MAX) {
      setError(`候補は最大${SLOTS_MAX}件までです（現在 ${slots.length} 件）`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/schedule/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          memo: memo.trim(),
          mode,
          deadline: deadline ? jstLocalToIso(deadline) : null,
          slots,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        id?: string;
        publicToken?: string;
        adminToken?: string;
      };
      if (!res.ok || !data.ok || !data.publicToken || !data.adminToken) {
        setError(data.message ?? "作成に失敗しました");
        setSubmitting(false);
        return;
      }
      saveMyEvent({
        id: data.id!,
        publicToken: data.publicToken,
        adminToken: data.adminToken,
        title: title.trim(),
        savedAt: new Date().toISOString(),
      });
      router.push(
        `/schedule/${data.publicToken}?admin=${data.adminToken}` as Route,
      );
    } catch {
      setError("通信に失敗しました");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* タイトル */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">イベント名</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: 新シナリオ「悪霊の家」卓"
          maxLength={200}
        />
      </div>

      {/* モード切替 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">候補の入れ方</label>
        <div className="flex gap-2">
          <ModeButton
            active={mode === "list"}
            onClick={() => setMode("list")}
            icon={<List className="h-4 w-4" />}
            label="候補を1つずつ"
          />
          <ModeButton
            active={mode === "grid"}
            onClick={() => setMode("grid")}
            icon={<LayoutGrid className="h-4 w-4" />}
            label="日付×時刻でまとめて"
          />
        </div>
      </div>

      {/* 候補エディタ */}
      {mode === "list" ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            {rows.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={r.date}
                  onChange={(e) =>
                    setRows((rs) =>
                      rs.map((x, j) =>
                        j === i ? { ...x, date: e.target.value } : x,
                      ),
                    )
                  }
                  className="w-40"
                />
                <Input
                  type="time"
                  value={r.time}
                  onChange={(e) =>
                    setRows((rs) =>
                      rs.map((x, j) =>
                        j === i ? { ...x, time: e.target.value } : x,
                      ),
                    )
                  }
                  className="w-28"
                />
                <Input
                  value={r.label}
                  onChange={(e) =>
                    setRows((rs) =>
                      rs.map((x, j) =>
                        j === i ? { ...x, label: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder="メモ(任意)"
                  className="min-w-[8rem] flex-1"
                  maxLength={100}
                />
                <button
                  type="button"
                  onClick={() =>
                    setRows((rs) =>
                      rs.length > 1 ? rs.filter((_, j) => j !== i) : rs,
                    )
                  }
                  className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="この候補を削除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setRows((rs) => [...rs, { date: "", time: "", label: "" }])
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              候補を追加
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">日付</div>
              {gridDates.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={d}
                    onChange={(e) =>
                      setGridDates((ds) =>
                        ds.map((x, j) => (j === i ? e.target.value : x)),
                      )
                    }
                    className="w-40"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setGridDates((ds) =>
                        ds.length > 1 ? ds.filter((_, j) => j !== i) : ds,
                      )
                    }
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="この日付を削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setGridDates((ds) => [...ds, ""])}
              >
                <CalendarPlus className="mr-1 h-4 w-4" />
                日付を追加
              </Button>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">時刻</div>
              <div className="flex flex-wrap gap-2">
                {GRID_TIME_PRESETS.map((t) => {
                  const on = gridTimes.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        setGridTimes((ts) =>
                          on ? ts.filter((x) => x !== t) : [...ts, t].sort(),
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors",
                        on
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 候補数プレビュー */}
      <p className="text-sm text-muted-foreground">
        候補 <span className="font-semibold text-foreground">{slotCount}</span>{" "}
        件
        {slotCount > SLOTS_MAX && (
          <span className="ml-2 text-destructive">
            （上限 {SLOTS_MAX} 件を超えています）
          </span>
        )}
      </p>

      {/* メモ・締切 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">メモ(任意)</label>
        <Textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="シナリオの概要、所要時間、ボイスの有無など"
          rows={3}
          maxLength={4000}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">締切(任意・表示のみ)</label>
        <Input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="w-60"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "作成中…" : "イベントを作成"}
        </Button>
        <span className="text-xs text-muted-foreground">
          作成後、共有用URLと管理用URLが出ます
        </span>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
