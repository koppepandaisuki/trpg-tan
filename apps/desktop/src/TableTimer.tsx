import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Timer, X } from "lucide-react";
import {
  formatTimer,
  pauseTimer,
  resetTimer,
  resumeTimer,
  startTimer,
  timerRemaining,
  type PlayTimer,
} from "@trpg/core";

/**
 * 卓のタイマー(デスクトップ)。Web 版 components/play/play-timer.tsx と同じ動き:
 * 状態は PlayScene.timer に入り、参加者には差分同期で届く。0 でチャイム 1 回。
 * 盤面の下部中央に浮かべる。GM だけ操作できる。
 */
const PRESETS = [60, 180, 300, 600];

export function TableTimer({
  timer,
  onChange,
}: {
  timer: PlayTimer | undefined;
  /** 渡すと GM 用(操作できる)。 */
  onChange?: (next: PlayTimer | undefined) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const chimed = useRef<string | null>(null);

  useEffect(() => {
    if (!timer?.endsAt) return;
    const h = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(h);
  }, [timer?.endsAt]);

  const remaining = timer ? timerRemaining(timer, now) : 0;
  const done = !!timer?.endsAt && remaining <= 0;
  useEffect(() => {
    if (!done || !timer?.endsAt || chimed.current === timer.endsAt) return;
    chimed.current = timer.endsAt;
    chime();
  }, [done, timer?.endsAt]);

  const canControl = !!onChange;
  if (!timer && !canControl) return null;

  return (
    <div className={`ttimer ${done ? "done" : timer?.endsAt ? "run" : ""}`}>
      {timer ? (
        <span className="ttimer-time" title={timer.label ?? "タイマー"}>
          <Timer size={13} />
          {done ? "時間切れ" : formatTimer(remaining)}
        </span>
      ) : (
        <button className="btn mini" onClick={() => setOpen((v) => !v)} title="全員の画面に出るタイマー">
          <Timer size={13} /> タイマー
        </button>
      )}
      {canControl && timer && (
        <>
          {timer.endsAt && !done ? (
            <button className="ttimer-btn" onClick={() => onChange(pauseTimer(timer, Date.now()))} title="一時停止">
              <Pause size={12} />
            </button>
          ) : (
            !done && (
              <button className="ttimer-btn" onClick={() => onChange(resumeTimer(timer, Date.now()))} title="再開">
                <Play size={12} />
              </button>
            )
          )}
          <button className="ttimer-btn" onClick={() => onChange(resetTimer(timer))} title="最初に戻す">
            <RotateCcw size={12} />
          </button>
          <button className="ttimer-btn" onClick={() => onChange(undefined)} title="消す">
            <X size={12} />
          </button>
        </>
      )}
      {canControl && !timer && open && (
        <span className="ttimer-presets">
          {PRESETS.map((s) => (
            <button
              key={s}
              className="btn mini"
              onClick={() => {
                onChange(startTimer(s, Date.now()));
                setOpen(false);
              }}
            >
              {s / 60}分
            </button>
          ))}
        </span>
      )}
    </div>
  );
}

function chime() {
  try {
    const ctx = new AudioContext();
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
    // 鳴らせなくても表示は出ている
  }
}
