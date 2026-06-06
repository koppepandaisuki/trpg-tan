import { useEffect, useMemo, useState } from "react";
import type { RollEvent } from "@trpg/core";

/**
 * パラDa-iCE ブランドのダイス・モーション。
 *
 * 判定(CoC d100)でも自由ダイス(2d6+1 等)でも、振るたびに中央に
 * フローティングカードが出て、ダイスがタイルとしてタンブル→一枚ずつ
 * “踊るように”ずれて着地(Da-iCE 風の振り付け)→結果バッジがポップする。
 *
 * 結果(roll.dice / total / check)は既に確定済み。見た目だけ演出する。
 */

const ROLL_MS = 620; // 最初の一枚が着地するまで
const STAGGER = 120; // タイルごとの着地ずれ
const HOLD_MS = 2200; // 着地後の表示時間

/** d100 を 十の位 / 一の位 の 2 タイルに分解(100 は 0,0)。 */
function d100Tiles(roll: number): number[] {
  if (roll === 100) return [0, 0];
  return [Math.floor((roll % 100) / 10), roll % 10];
}

function randFace(isCheck: boolean): number {
  return isCheck ? Math.floor(Math.random() * 10) : Math.floor(Math.random() * 9) + 1;
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
    () => (isCheck ? d100Tiles(roll.check!.roll) : roll.dice.length ? roll.dice : [0]),
    [roll, isCheck],
  );
  const lastLand = ROLL_MS + (finals.length - 1) * STAGGER;

  const [faces, setFaces] = useState<number[]>(() => finals.map(() => 0));
  const [landed, setLanded] = useState<boolean[]>(() => finals.map(() => false));
  const allLanded = landed.every(Boolean);

  // 経過時間ベースで毎フレーム面を更新(着地済みは最終値で固定)。
  useEffect(() => {
    const start = Date.now();
    const iv = window.setInterval(() => {
      const el = Date.now() - start;
      setFaces(finals.map((fin, i) => (el >= ROLL_MS + i * STAGGER ? fin : randFace(isCheck))));
      setLanded(finals.map((_, i) => el >= ROLL_MS + i * STAGGER));
      if (el >= lastLand) window.clearInterval(iv);
    }, 55);
    return () => window.clearInterval(iv);
  }, [finals, isCheck, lastLand]);

  // 着地後に自動クローズ + Esc。
  useEffect(() => {
    if (!allLanded) return;
    const t = window.setTimeout(onClose, HOLD_MS);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [allLanded, onClose]);

  const tone = roll.check ? levelTone(roll.check.level) : "ok";
  const bigValue = isCheck ? roll.check!.roll : roll.total;

  return (
    <div className="dm-overlay" onClick={onClose} role="dialog" aria-label="ダイスロール">
      <div
        className={`dm-card ${allLanded ? `landed ${tone}` : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="dm-brand">パラDa-iCE</span>
        <p className="dm-label">{roll.label}</p>
        {roll.notation && <p className="dm-notation">{roll.notation}</p>}

        <div className="dm-dice">
          {faces.map((f, i) => (
            <span
              key={i}
              className={`dm-die ${landed[i] ? "land" : "spin"}`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {f}
            </span>
          ))}
        </div>

        <p className="dm-total">{allLanded ? bigValue : "··"}</p>

        {allLanded &&
          (roll.check ? (
            <p className={`dm-result ${tone}`}>
              {levelLabel(roll.check.level)}
              <span className="dm-target">／ 目標 {roll.check.target}</span>
            </p>
          ) : (
            <p className="dm-result ok">合計 {roll.total}</p>
          ))}

        <p className="dm-hint">クリック / Esc で閉じる</p>
      </div>
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
