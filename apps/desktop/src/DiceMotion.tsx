import { useEffect, useMemo, useRef, useState } from "react";
import { parseDiceNotation, type RollEvent } from "@trpg/core";
import {
  playDiceRoll,
  playSuccess,
  playCritical,
  playFumble,
} from "./dice-sound";
import { getSoundSettings } from "./sound-settings";

/**
 * ダイス・モーション(CCFOLIA 風)。振った記法どおりの「本物の形のダイス」が
 * 画面上から降ってきて転がり、実際の出目を面に表示して着地する。
 *
 *   - 2d6+1d10 など → d6 が 2 個 + d10 が 1 個、それぞれの出目で着地
 *   - CoC 判定(1d100) → 十の位(00-90)と一の位(0-9)の d10 ペア(実物の percentile)
 *   - 演出は非ブロッキング(盤面操作を妨げない)。自動で消える / Esc / ×
 *
 * 結果(roll.dice / total / check)は確定済み。見た目と音だけ演出する。
 */

const ROLL_MS = 1150;
const FREEZE_MS = 900;
const HOLD_MS = 2400;
const GAP = 14;

interface DieSpec {
  /** 形を決める面数(100 = percentile の十の位ダイス)。 */
  sides: number;
  /** 着地時に見せる出目テキスト。 */
  finalText: string;
}

/** RollEvent → 表示するダイス列(形 + 確定出目)。 */
function buildDice(roll: RollEvent): DieSpec[] {
  if (roll.check) {
    const v = roll.check.roll; // 1..100
    const tens = Math.floor((v % 100) / 10) * 10; // 100 → 00
    const units = v % 10;
    return [
      { sides: 100, finalText: String(tens).padStart(2, "0") },
      { sides: 10, finalText: String(units) },
    ];
  }
  if (roll.notation) {
    try {
      const specs: DieSpec[] = [];
      let i = 0;
      for (const t of parseDiceNotation(roll.notation)) {
        for (let k = 0; k < t.count && i < roll.dice.length; k++, i++) {
          specs.push({ sides: t.sides, finalText: String(roll.dice[i]) });
        }
      }
      if (specs.length > 0) return specs;
    } catch {
      // 解析できなければ既定形へフォールバック
    }
  }
  return roll.dice.map((v) => ({
    sides: v <= 6 ? 6 : 20,
    finalText: String(v),
  }));
}

/** 回転中に見せるランダムな出目。 */
function randFace(sides: number): string {
  if (sides === 100) {
    return String(Math.floor(Math.random() * 10) * 10).padStart(2, "0");
  }
  if (sides === 10) return String(Math.floor(Math.random() * 10));
  return String(Math.floor(Math.random() * Math.max(sides, 2)) + 1);
}

/** 面数 → 表示サイズ(px)。大きいダイスほど少し大きく。 */
function sizeOf(sides: number): number {
  if (sides >= 100) return 64;
  if (sides >= 20) return 62;
  if (sides >= 12) return 60;
  return 56;
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
  const settleRot = Math.round(rot / 360) * 360 + (Math.random() * 10 - 5);
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
  masked = false,
  onClose,
}: {
  roll: RollEvent;
  /** 秘匿表示(参加者ビューのシークレットダイス): 灰色の無地ダイス + 結果「？」。 */
  masked?: boolean;
  onClose: () => void;
}) {
  const dice = useMemo(() => buildDice(roll), [roll]);
  const dieRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [faces, setFaces] = useState<string[]>(() =>
    dice.map((d) => (masked ? "" : randFace(d.sides))),
  );
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const sizes = dice.map((d) => sizeOf(d.sides));
    const totalW = sizes.reduce((a, b) => a + b, 0) + (dice.length - 1) * GAP;
    const baseX = Math.max(20, (W - totalW) / 2);
    const restY = H * 0.38;

    playDiceRoll(ROLL_MS / 1000, dice.length);

    let x = baseX;
    const anims = dice.map((d, i) => {
      const el = dieRefs.current[i];
      const endX = x;
      x += sizes[i] + GAP;
      if (!el) return null;
      el.style.visibility = "visible";
      return el.animate(tumbleKeyframes(endX, restY, W, H, sizes[i]), {
        duration: ROLL_MS + Math.random() * 200,
        easing: "cubic-bezier(0.16, 0.7, 0.27, 1)",
        fill: "forwards",
        delay: i * 70,
      });
    });

    // 秘匿時は出目を一切見せない(回転中も無地のまま)。
    const iv = masked
      ? 0
      : window.setInterval(() => {
          setFaces(dice.map((d) => randFace(d.sides)));
        }, 70);

    const freezeT = window.setTimeout(() => {
      if (iv) window.clearInterval(iv);
      setFaces(dice.map((d) => (masked ? "" : d.finalText)));
    }, FREEZE_MS);

    const settleT = window.setTimeout(() => {
      setSettled(true);
      // 成功度の効果音は出目のネタバレになるので秘匿時は鳴らさない。
      if (roll.check && !masked) {
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
      if (iv) window.clearInterval(iv);
      window.clearTimeout(freezeT);
      window.clearTimeout(settleT);
      anims.forEach((a) => a?.cancel());
    };
    // dice は roll から導出され、roll ごとに 1 回だけ実行する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roll, masked]);

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

  const tone = roll.check
    ? levelTone(roll.check.level)
    : roll.success === undefined
      ? "ok"
      : roll.success
        ? "ok"
        : "fail";
  const bigValue = roll.check ? roll.check.roll : roll.total;

  return (
    <div className="dm-overlay" role="status" aria-label="ダイスロール">
      {dice.map((d, i) => (
        <div
          key={i}
          ref={(el) => {
            dieRefs.current[i] = el;
          }}
          className={`dm-die ${masked ? "masked" : settled ? tone : ""}`}
          style={{ visibility: "hidden", width: sizeOf(d.sides), height: sizeOf(d.sides) }}
        >
          <DieSvg sides={d.sides} text={faces[i] ?? ""} />
        </div>
      ))}

      {settled && (
        <div className="dm-readout">
          <button className="dm-close" onClick={onClose} title="閉じる" aria-label="閉じる">
            ×
          </button>
          {masked ? (
            <>
              {/* 秘匿: ラベルも出目も伏せる(コマンド内容からの推測も防ぐ)。 */}
              <p className="dm-label">
                <span className="dm-actor">{roll.actor}</span> シークレットダイス
              </p>
              <p className="dm-total masked">？</p>
              <p className="dm-result fail">出目は非公開</p>
            </>
          ) : (
            <>
              <p className="dm-label">
                <span className="dm-actor">{roll.actor}</span> {roll.label}
              </p>
              <p className="dm-total">{bigValue}</p>
              {roll.check ? (
                <p className={`dm-result ${tone}`}>
                  {levelLabel(roll.check.level)}
                  <span className="dm-target">／ 目標 {roll.check.target}</span>
                </p>
              ) : (
                <p className={`dm-result ${tone}`}>
                  {roll.notation ? `${roll.notation} ＝ ` : "合計 "}
                  [{roll.dice.join(", ")}] → {roll.total}
                  {roll.success !== undefined && (
                    <span> {roll.success ? "成功" : "失敗"}</span>
                  )}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ===== ダイスの形(SVG ポリゴン + 数字/ピップ) ===== */

const SHAPES: Record<number, string> = {
  4: "50,6 95,90 5,90",
  8: "50,4 96,50 50,96 4,50",
  10: "50,3 93,38 76,94 24,94 7,38",
  12: "50,3 88,21 97,62 73,96 27,96 3,62 12,21",
  20: "27,8 73,8 97,50 73,92 27,92 3,50",
  100: "50,3 93,38 76,94 24,94 7,38",
};

/** 内側のファセット線(立体感)。形ごとに 1 本〜数本。 */
const FACETS: Record<number, string[]> = {
  4: ["50,6 50,90"],
  8: ["50,4 50,96", "4,50 96,50"],
  10: ["50,3 50,94", "7,38 50,60 93,38"],
  12: ["50,3 50,40", "3,62 38,55", "97,62 62,55", "27,96 45,60"],
  20: ["27,8 50,30 73,8", "3,50 50,30", "97,50 50,30", "50,30 50,92"],
  100: ["50,3 50,94", "7,38 50,60 93,38"],
};

/** d6 のピップ配置(値 1〜6)。 */
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 28], [70, 28], [30, 50], [70, 50], [30, 72], [70, 72]],
};

function DieSvg({ sides, text }: { sides: number; text: string }) {
  if (sides === 6) {
    const v = Number(text);
    const pips = PIPS[v];
    return (
      <svg viewBox="0 0 100 100" className="dm-svg">
        <rect x="5" y="5" width="90" height="90" rx="18" className="dm-body" />
        {pips ? (
          pips.map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="8.5" className="dm-pip" />
          ))
        ) : (
          <text x="50" y="50" className="dm-num">
            {text}
          </text>
        )}
      </svg>
    );
  }

  const shape = SHAPES[sides] ?? SHAPES[20];
  const facets = FACETS[sides] ?? [];
  const small = text.length >= 3;
  return (
    <svg viewBox="0 0 100 100" className="dm-svg">
      <polygon points={shape} className="dm-body" />
      {facets.map((p, i) => (
        <polyline key={i} points={p} className="dm-facet" />
      ))}
      <text
        x="50"
        y={sides === 4 ? 62 : 56}
        className={`dm-num ${small ? "small" : ""}`}
      >
        {text}
      </text>
      {sides === 100 && (
        <text x="50" y="78" className="dm-pct">
          %
        </text>
      )}
    </svg>
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
