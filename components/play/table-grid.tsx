"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Dices, Trash2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { PlaySessionSummary } from "@/lib/queries/play-sessions";

/**
 * 保存した卓のカード一覧。PLAY ロビー(最近の卓)とライブラリ(すべての卓)で
 * 同じ見た目にするための共通部品。クリックで卓を開く。
 */
export function TableGrid({
  sessions,
  onRemove,
  empty,
}: {
  sessions: PlaySessionSummary[];
  /** 渡すとカードに削除ボタンが出る。 */
  onRemove?: (s: PlaySessionSummary) => void;
  empty: string;
}) {
  const router = useRouter();

  if (sessions.length === 0) {
    return (
      <Card className="border-dashed border-border">
        <CardContent className="py-8 text-center">
          <Dices
            className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50"
            aria-hidden
          />
          <p className="text-sm text-muted-foreground">{empty}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sessions.map((s) => (
        <li key={s.id}>
          <Card className="group relative overflow-hidden border-border transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
            <button
              onClick={() => router.push(`/play/${s.id}` as Route)}
              className="block w-full text-left"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                {s.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.thumbnail}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Dices
                      className="h-7 w-7 text-muted-foreground/40"
                      aria-hidden
                    />
                  </div>
                )}
              </div>
              <CardContent className="space-y-1 py-3">
                <p className="line-clamp-1 text-sm font-semibold">{s.title}</p>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {s.systemLabel && (
                    <>
                      <span className="truncate">{s.systemLabel}</span>
                      <span>・</span>
                    </>
                  )}
                  <span className="inline-flex shrink-0 items-center gap-1">
                    <Users className="h-3 w-3" aria-hidden />
                    {s.panelCount} 駒
                  </span>
                  <span>・</span>
                  <span className="shrink-0">{formatDate(s.updatedAt)}</span>
                </div>
              </CardContent>
            </button>
            {onRemove && (
              <button
                onClick={() => onRemove(s)}
                title="この卓を削除"
                aria-label={`「${s.title}」を削除`}
                className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-muted-foreground opacity-0 transition hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
