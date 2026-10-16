"use client";

import { useEffect, useRef, useState } from "react";
import type { CoCSuccessLevel, PlayEvent, RollEvent } from "@trpg/core";

/**
 * ダイスの結果を盤面の上に大きく一瞬だけ出す(没入用の演出)。盤面を包む
 * relative な要素の中に置く。
 * ログに新しいダイスが入ったときだけ出す(開いた直後の既存ログでは出さない)。
 * 出目の分からないシークレットダイスは出さない。操作の邪魔をしないよう
 * クリックは素通しにする。
 */
export function PlayDiceFlash({
  log,
  showSecret = false,
}: {
  log: PlayEvent[];
  /** GM はシークレットダイスも出す(自分の画面だけ)。 */
  showSecret?: boolean;
}) {
  const [roll, setRoll] = useState<RollEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const lastId = useRef<string | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    const last = [...log].reverse().find((e): e is RollEvent => e.kind === "roll");
    if (!ready.current) {
      // 開いた時点のログは演出しない。
      ready.current = true;
      lastId.current = last?.id ?? null;
      return;
    }
    if (!last || last.id === lastId.current) return;
    lastId.current = last.id;
    if (last.redacted || (last.secret && !showSecret)) return;
    setRoll(last);
    setVisible(true);
    const t1 = window.setTimeout(() => setVisible(false), 1600);
    const t2 = window.setTimeout(() => setRoll(null), 2000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [log, showSecret]);

  if (!roll) return null;
  const ok = roll.check ? roll.check.isSuccess : roll.success;
  const tone = ok === true ? "text-emerald-300" : ok === false ? "text-rose-300" : "text-white";
  const outcome = roll.check
    ? levelText(roll.check.level)
    : roll.detail && roll.detail.length <= 16
      ? roll.detail
      : ok === true
        ? "成功"
        : ok === false
          ? "失敗"
          : "";

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none absolute inset-x-0 top-1/3 z-30 flex justify-center transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      <div className="rounded-2xl bg-black/75 px-6 py-3 text-center shadow-2xl backdrop-blur">
        <p className="text-xs text-white/70">
          {roll.actor} · {roll.label}
          {roll.secret ? "(秘匿)" : ""}
        </p>
        <p className={`text-4xl font-black tabular-nums ${tone}`}>{roll.total}</p>
        {outcome && <p className={`text-sm font-bold ${tone}`}>{outcome}</p>}
      </div>
    </div>
  );
}

function levelText(level: CoCSuccessLevel): string {
  switch (level) {
    case "extreme":
      return "イクストリーム成功";
    case "hard":
      return "ハード成功";
    case "special":
      return "スペシャル!";
    case "regular":
      return "成功";
    case "fail":
      return "失敗";
    case "fumble":
      return "ファンブル…";
  }
}
