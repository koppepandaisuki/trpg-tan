import { describe, it, expect } from "vitest";
import {
  startTimer,
  pauseTimer,
  resumeTimer,
  resetTimer,
  timerRemaining,
  timerRunning,
  formatTimer,
} from "../src/play/index.js";

const T0 = Date.parse("2026-10-14T00:00:00.000Z");

describe("卓のタイマー", () => {
  it("始める → 残りが減る → 0 で止まる", () => {
    const t = startTimer(180, T0, "探索");
    expect(timerRunning(t)).toBe(true);
    expect(timerRemaining(t, T0 + 60_000)).toBe(120);
    expect(timerRemaining(t, T0 + 999_000)).toBe(0);
  });
  it("一時停止と再開で残りを引き継ぐ", () => {
    const t = startTimer(100, T0);
    const p = pauseTimer(t, T0 + 30_500);
    expect(timerRunning(p)).toBe(false);
    expect(p.remainingSec).toBe(70);
    expect(timerRemaining(p, T0 + 999_000)).toBe(70);
    const r = resumeTimer(p, T0 + 500_000);
    expect(timerRemaining(r, T0 + 510_000)).toBe(60);
  });
  it("リセットは最初の長さで止まった状態", () => {
    const t = resetTimer(startTimer(300, T0));
    expect(t).toMatchObject({ endsAt: null, remainingSec: 300, durationSec: 300 });
  });
  it("表示", () => {
    expect(formatTimer(245)).toBe("4:05");
    expect(formatTimer(3723)).toBe("1:02:03");
    expect(formatTimer(0.2)).toBe("0:01");
    expect(formatTimer(0)).toBe("0:00");
  });
});
