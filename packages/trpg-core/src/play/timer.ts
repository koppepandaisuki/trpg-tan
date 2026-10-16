import type { PlayTimer } from "./types.js";

/**
 * 卓のタイマー(純粋関数)。ココフォリアでは有料(PRO)の機能。
 * 状態は PlayScene.timer に入り、差分同期で参加者にも届く。
 */

const MAX_SEC = 24 * 60 * 60;

function clampSec(sec: number): number {
  return Math.max(0, Math.min(MAX_SEC, Math.round(sec)));
}

/** 残り秒(小数)。 */
export function timerRemaining(t: PlayTimer, nowMs: number): number {
  if (!t.endsAt) return t.remainingSec;
  return Math.max(0, (Date.parse(t.endsAt) - nowMs) / 1000);
}

export function timerRunning(t: PlayTimer | undefined): boolean {
  return !!t?.endsAt;
}

/** 新しくタイマーを始める。 */
export function startTimer(sec: number, nowMs: number, label?: string): PlayTimer {
  const d = clampSec(sec);
  return {
    ...(label ? { label } : {}),
    durationSec: d,
    endsAt: new Date(nowMs + d * 1000).toISOString(),
    remainingSec: d,
  };
}

export function pauseTimer(t: PlayTimer, nowMs: number): PlayTimer {
  if (!t.endsAt) return t;
  return { ...t, endsAt: null, remainingSec: Math.ceil(timerRemaining(t, nowMs)) };
}

export function resumeTimer(t: PlayTimer, nowMs: number): PlayTimer {
  if (t.endsAt || t.remainingSec <= 0) return t;
  return { ...t, endsAt: new Date(nowMs + t.remainingSec * 1000).toISOString() };
}

/** 最初の長さに戻して止める。 */
export function resetTimer(t: PlayTimer): PlayTimer {
  return { ...t, endsAt: null, remainingSec: t.durationSec };
}

/** 残り時間の表示("4:05" / "1:02:03")。 */
export function formatTimer(sec: number): string {
  const s = Math.ceil(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(r).padStart(2, "0")}`;
}
