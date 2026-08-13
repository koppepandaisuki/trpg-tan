"use client";

import { SkipForward, Timer, X } from "lucide-react";
import type { Panel } from "@trpg/core";

/**
 * ターン(ラウンド / 手番)管理。GM だけが操作でき、結果は state 配信で全員に届く。
 *
 * 巡回順は「速さ(speed)の降順」。desktop の PlayTable と同じ並び・同じ
 * ログ文言にしてあるので、web と desktop が混ざった卓でも進行がぶれない。
 */
export function PlayTurnBar({
  panels,
  turn,
  onNext,
  onReset,
  disabled,
  readOnly,
}: {
  /** 手番の対象(GM ビューは秘匿駒も含む)。 */
  panels: Panel[];
  turn: { round: number; activePanelId: string | null } | undefined;
  onNext?: (round: number, panel: Panel, label: string) => void;
  onReset?: () => void;
  disabled?: boolean;
  /** 参加者ビュー: 誰の手番かを見るだけ(操作は GM のみ)。 */
  readOnly?: boolean;
}) {
  const order = turnOrder(panels);
  const round = turn?.round ?? 0;
  const active = panels.find((p) => p.id === turn?.activePanelId) ?? null;
  const running = round > 0;

  function next() {
    if (order.length === 0) return;
    const i = order.findIndex((p) => p.id === turn?.activePanelId);
    // 一巡したら先頭へ戻ってラウンド +1。未開始(round 0)は先頭から。
    const wrap = i >= 0 && i + 1 >= order.length;
    const target = round === 0 || i < 0 ? order[0] : order[wrap ? 0 : i + 1];
    const nextRound = round === 0 ? 1 : wrap ? round + 1 : round;
    onNext?.(
      nextRound,
      target,
      `⏱ ラウンド${nextRound} — ${target.name} の手番`,
    );
  }

  if (order.length === 0) return null;
  // 参加者側は、まだ始まっていないターン管理の枠を出しても意味が無い。
  if (readOnly && !running) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5">
      <Timer className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      {running ? (
        <span className="text-xs">
          <span className="font-semibold tabular-nums">ラウンド{round}</span>
          {active && (
            <>
              <span className="mx-1 text-muted-foreground">·</span>
              <span className="font-semibold text-primary">{active.name}</span>
              <span className="text-muted-foreground"> の手番</span>
            </>
          )}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">ターン管理</span>
      )}

      {!readOnly && (
        <>
          <button
            onClick={next}
            disabled={disabled}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs transition hover:bg-muted disabled:opacity-50"
          >
            <SkipForward className="h-3 w-3" aria-hidden />
            {running ? "次の手番" : "開始"}
          </button>
          {running && (
            <button
              onClick={onReset}
              disabled={disabled}
              title="ターン管理をリセット"
              className="rounded-md border border-border px-1.5 py-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 手番の巡回順。desktop と同じ規則:
 *   - 能力値もリソースも持たない駒(ただの目印トークン)は対象外
 *   - 速さ(speed)の降順。未設定は最後尾
 */
export function turnOrder(panels: Panel[]): Panel[] {
  return panels
    .filter((p) => p.stats.length > 0 || p.resources.length > 0)
    .sort((a, b) => (b.speed ?? -Infinity) - (a.speed ?? -Infinity));
}
