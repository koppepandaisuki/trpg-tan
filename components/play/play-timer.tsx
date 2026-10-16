"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Timer, X } from "lucide-react";
import {
  formatTimer,
  pauseTimer,
  resetTimer,
  resumeTimer,
  startTimer,
  timerRemaining,
  type PlayTimer as PlayTimerState,
} from "@trpg/core";
import { toolButton } from "@/components/ui/button";

/**
 * 卓のタイマー(Web)。GM が操作し、参加者にも同じ残り時間が出る
 * (状態は PlayScene.timer に入り、差分同期で届く)。
 * 0 になったら全員の画面で短いチャイムを 1 回鳴らす。
 */

const PRESETS = [60, 180, 300, 600];

export function PlayTimer({
  timer,
  canControl,
  onChange,
}: {
  timer: PlayTimerState | undefined;
  /** GM だけ操作できる。 */
  canControl: boolean;
  onChange?: (next: PlayTimerState | undefined) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const chimed = useRef<string | null>(null);

  useEffect(() => {
    if (!timer?.endsAt) return;
    const h = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(h);
  }, [timer?.endsAt]);

  const remaining = timer ? timerRemaining(timer, now) : 0;
  const done = !!timer?.endsAt && remaining <= 0;

  // 0 になった瞬間に 1 回だけ鳴らす(同じタイマーでは鳴らし直さない)。
  useEffect(() => {
    if (!done || !timer?.endsAt || chimed.current === timer.endsAt) return;
    chimed.current = timer.endsAt;
    chime();
  }, [done, timer?.endsAt]);

  if (!timer && !canControl) return null;

  const set = (t: PlayTimerState | undefined) => onChange?.(t);

  return (
    <span className="relative inline-flex items-center gap-1">
      {timer ? (
        <span
          className={`inline-flex h-7 items-center gap-1 rounded-full border px-3 font-mono text-xs tabular-nums ${
            done
              ? "animate-pulse border-primary bg-primary text-primary-foreground"
              : timer.endsAt
                ? "border-ink bg-ink text-ink-foreground"
                : "border-border bg-muted text-muted-foreground"
          }`}
          title={timer.label ? `タイマー: ${timer.label}` : "タイマー"}
        >
          <Timer className="h-3.5 w-3.5" aria-hidden />
          {timer.label && <span className="font-sans">{timer.label}</span>}
          {done ? "時間切れ" : formatTimer(remaining)}
        </span>
      ) : null}

      {canControl && timer && (
        <>
          {timer.endsAt && !done ? (
            <button
              type="button"
              onClick={() => set(pauseTimer(timer, Date.now()))}
              title="一時停止"
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <Pause className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : (
            !done && (
              <button
                type="button"
                onClick={() => set(resumeTimer(timer, Date.now()))}
                title="再開"
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              >
                <Play className="h-3.5 w-3.5" aria-hidden />
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => set(resetTimer(timer))}
            title="最初に戻す"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => set(undefined)}
            title="タイマーを消す"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </>
      )}

      {canControl && !timer && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={toolButton}
          title="制限時間・休憩などのタイマー(全員の画面に出ます)"
        >
          <Timer className="h-3.5 w-3.5" aria-hidden />
          タイマー
        </button>
      )}

      {open && canControl && !timer && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-md border border-border bg-background p-2 text-xs shadow-lg">
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  set(startTimer(s, Date.now()));
                  setOpen(false);
                }}
                className={toolButton}
              >
                {s / 60}分
              </button>
            ))}
          </div>
          <form
            className="mt-2 flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              const min = parseFloat(custom);
              if (!(min > 0)) return;
              set(startTimer(min * 60, Date.now()));
              setCustom("");
              setOpen(false);
            }}
          >
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              inputMode="decimal"
              placeholder="分を入力"
              className="min-w-0 flex-1 rounded border border-border px-2 py-0.5"
            />
            <button
              type="submit"
              className="rounded bg-primary px-2 py-0.5 text-primary-foreground"
            >
              開始
            </button>
          </form>
        </div>
      )}
    </span>
  );
}

/** 短いチャイム(音声ファイル不要)。自動再生の制限で鳴らなくても表示は出る。 */
function chime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t = ctx.currentTime;
    for (const [i, f] of [880, 660].entries()) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.25);
      g.gain.exponentialRampToValueAtTime(0.2, t + i * 0.25 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.25 + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(t + i * 0.25);
      o.stop(t + i * 0.25 + 0.45);
    }
    window.setTimeout(() => void ctx.close(), 1200);
  } catch {
    // 鳴らせない環境でも表示は出ている
  }
}
