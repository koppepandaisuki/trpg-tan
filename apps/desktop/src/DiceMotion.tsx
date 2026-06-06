import { useEffect, useMemo, useRef, useState } from "react";
import type { RollEvent } from "@trpg/core";
import {
  playDiceRoll,
  playSuccess,
  playCritical,
  playFumble,
} from "./dice-sound";
import { getSoundSettings } from "./sound-settings";

/**
 * パラDa-iCE ダイス・モーション(物理転がり + 効果音)。
 *
 * 振るたびに実際のサイコロが画面の上から降ってきて、ランダムな軌道で
 * 画面内を跳ね回りながら回転し、中央へ着地して出目を見せる。転がり音
 * (からから→トン)を Web Audio で同時に鳴らす。
 *
 *   - 判定(CoC): 1 個の 100 面ダイス(1〜100 を表示)。
 *   - 自由ダイス: 記法の各ダイスを 1 個ずつ。
 *
 * 結果(roll.dice / total / check)は確定済み。見た目と音だけ演出する。
 */

const ROLL_MS = 1150;
const FREEZE_MS = 900;
const HOLD_MS = 2200;
const GAP = 16;

function randFace(isCheck: boolean): number {
  return isCheck
    ? Math.floor(Math.random() * 100) + 1
    : Math.floor(Math.random() * 6) + 1;
}

/** 画面内をランダムに跳ね回って resting(endX,endY) へ着地する keyframe 列。 */
function tumbleKeyframes(
  endX: number,
  endY: number,
  W: number,
  H: number,
  size: number,
): Keyframe[] {
  const m = 70;
  const rx = () => m + Math.random() * (W - 2 * m - size);
  const ry = () => m + Math.random() * (H - 2 * m - size);
  const spin = () => (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540);

  const frames: Keyframe[] = [];
  let rot = 0;
  frames.push({
    transform: `translate(${rx()}px, -90px) rotate(0deg) scale(0.8)`,
    offset: 0,
    opacity: 1,
  });
  const waypoints = 3 + Math.floor(Math.random() * 2);
  for (let i = 1; i <= waypoints; i++) {
    rot += spin();
    frames.push({
      transform: `translate(${rx()}px, ${ry()}px) rotate(${rot}deg) scale(1)`,
      offset: (i / (waypoints + 1)) * 0.92,
    });
  }
  const settleRot = Math.round(rot / 90) * 90 + (Math.random() * 8 - 4);
  frames.push({
    transform: `translate(${endX}px, ${endY - 16}px) rotate(${settleRot}deg) scale(1.08)`,
    offset: 0.96,
  });
  frames.push({
    transform: `translate(${endX}px, ${endY}px) rotate(${settleRot}deg) scale(1)`,
    offset: 1,
  });
  return frames;
}

export function DiceMotion({
  roll,
  onClose,
}: {
  roll: RollEvent;
  onClose: () => void;
}) {
  const isCheck = !!roll.check;
  const finals = useMemo<number[]>(
    () => (isCheck ? [roll.check!.roll] : roll.dice.length ? roll.dice : [0]),
    [roll, isCheck],
  );
  const dieSize = isCheck ? 68 : 56;
  const dieRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const totalW = finals.length * dieSize + (finals.length - 1) * GAP;
    const baseX = (W - totalW) / 2;
    const restY = H * 0.4;

    // 効果音(転がり時間に合わせる)。
    playDiceRoll(ROLL_MS / 1000, finals.length);

    const anims = finals.map((_, i) => {
      const el = dieRefs.current[i];
      if (!el) return null;
      el.style.visibility = "visible";
      const endX = baseX + i * (dieSize + GAP);
      return el.animate(tumbleKeyframes(endX, restY, W, H, dieSize), {
        duration: ROLL_MS + Math.random() * 200,
        easing: "cubic-bezier(0.16, 0.7, 0.27, 1)",
        fill: "forwards",
        delay: i * 70,
      });
    });

    const start = Date.now();
    const iv = window.setInterval(() => {
      const el = Date.now() - start;
      finals.forEach((fin, i) => {
        const face = dieRefs.current[i]?.querySelector(".dm-face");
        if (face) face.textContent = String(el >= FREEZE_MS ? fin : randFace(isCheck));
      });
    }, 70);

    const settleT = window.setTimeout(() => {
      window.clearInterval(iv);
      finals.forEach((fin, i) => {
        const face = dieRefs.current[i]?.querySelector(".dm-face");
        if (face) face.textContent = String(fin);
      });
      setSettled(true);
      // 成功度に応じて鳴り分け(各設定 on のとき)。
      if (roll.check) {
        const s = getSoundSettings();
        const lvl = roll.check.level;
        if (lvl === "fumble") {
          if (s.fumbleEnabled) playFumble();
        } else if (lvl === "extreme" || lvl === "special") {
          if (s.criticalEnabled) playCritical();
        } else if (roll.check.isSuccess) {
          if (s.successEnabled) playSuccess(s.successType);
        }
      }
    }, ROLL_MS);

    return () => {
      window.clearInterval(iv);
      window.clearTimeout(settleT);
      anims.forEach((a) => a?.cancel());
    };
  }, [finals, isCheck, dieSize]);

  useEffect(() => {
    if (!settled) return;
    const t = window.setTimeout(onClose, HOLD_MS);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [settled, onClose]);

  const tone = roll.check ? levelTone(roll.check.level) : "ok";
  const bigValue = isCheck ? roll.check!.roll : roll.total;

  return (
    <div className="dm-overlay" onClick={onClose} role="dialog" aria-label="ダイスロール">
      {finals.map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            dieRefs.current[i] = el;
          }}
          className={`dm-die3d ${isCheck ? "d100" : ""} ${settled ? tone : ""}`}
          style={{ visibility: "hidden" }}
        >
          <span className="dm-face">0</span>
        </div>
      ))}

      {settled && (
        <div className="dm-readout">
          <p className="dm-label">{roll.label}</p>
          <p className="dm-total">{bigValue}</p>
          {roll.check ? (
            <p className={`dm-result ${tone}`}>
              {levelLabel(roll.check.level)}
              <span className="dm-target">／ 目標 {roll.check.target}</span>
            </p>
          ) : (
            <p className="dm-result ok">
              {roll.notation ? `${roll.notation} = ` : "合計 "}
              {roll.total}
            </p>
          )}
          <p className="dm-hint">クリック / Esc で閉じる</p>
        </div>
      )}
    </div>
  );
}

function levelTone(level: string): string {
  switch (level) {
    case "extreme":
      return "crit";
    case "special":
      return "gold";
    case "hard":
    case "regular":
      return "ok";
    case "fumble":
      return "fumble";
    default:
      return "fail";
  }
}

function levelLabel(level: string): string {
  switch (level) {
    case "extreme":
      return "イクストリーム成功！";
    case "hard":
      return "ハード成功";
    case "regular":
      return "成功";
    case "special":
      return "スペシャル！";
    case "fumble":
      return "ファンブル…";
    default:
      return "失敗";
  }
}
