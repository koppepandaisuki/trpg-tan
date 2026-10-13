import { useEffect, useRef, useState } from "react";

/**
 * −/＋ボタン付き数値入力。キャラシの「数値が変えづらい」対策の共通部品。
 *
 * - クリックで ±1、Shift+クリックで ±5、長押しで連続変化。
 * - 数字クリックで全選択 → そのまま打ち替え(確定時にmin/maxへクランプ)。
 */
export function NumStepper({
  value,
  onChange,
  min = 0,
  max = 999,
  big = false,
  warn = false,
  title,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  /** 能力値タイル用の大きい表示 */
  big?: boolean;
  /** 注意喚起(職業技能外への割り振りなど) */
  warn?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  // 入力中は自由に打てるようドラフト保持、blur で確定値に同期。
  const [draft, setDraft] = useState<string | null>(null);
  const valRef = useRef(value);
  valRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const timers = useRef<{ t: number | null; i: number | null }>({
    t: null,
    i: null,
  });

  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));

  function stopHold() {
    if (timers.current.t !== null) {
      clearTimeout(timers.current.t);
      timers.current.t = null;
    }
    if (timers.current.i !== null) {
      clearInterval(timers.current.i);
      timers.current.i = null;
    }
  }

  function startHold(dir: 1 | -1, shift: boolean) {
    const step = dir * (shift ? 5 : 1);
    const apply = () => onChangeRef.current(clamp(valRef.current + step));
    apply();
    stopHold();
    timers.current.t = window.setTimeout(() => {
      timers.current.i = window.setInterval(apply, 70);
    }, 400);
  }

  useEffect(() => stopHold, []);

  const btnProps = (dir: 1 | -1) => ({
    type: "button" as const,
    className: "nstep-btn",
    disabled: dir < 0 ? value <= min : value >= max,
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault(); // フォーカス移動と onClick 二重発火を避ける
      startHold(dir, e.shiftKey);
    },
    onPointerUp: stopHold,
    onPointerLeave: stopHold,
    onPointerCancel: stopHold,
    title: `${dir > 0 ? "+1" : "−1"}(長押しで連続 / Shift+クリックで ${dir > 0 ? "+5" : "−5"})`,
    "aria-label": `${ariaLabel ?? "値"}を${dir > 0 ? "増やす" : "減らす"}`,
  });

  return (
    <div
      className={`nstep${big ? " big" : ""}${warn ? " warn" : ""}`}
      title={title}
    >
      <button {...btnProps(-1)}>−</button>
      <input
        className="nstep-val"
        type="number"
        inputMode="numeric"
        value={draft ?? value}
        min={min}
        max={max}
        aria-label={ariaLabel}
        onFocus={(e) => {
          setDraft(String(valRef.current));
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n)) onChange(clamp(n));
        }}
        onBlur={() => setDraft(null)}
      />
      <button {...btnProps(1)}>＋</button>
    </div>
  );
}
