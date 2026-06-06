import { useEffect, useState } from "react";
import type { CoCCheckResult } from "@trpg/core";

/**
 * ココフォリア風のダイスロール演出。1D100 を 2 つの d10(十の位 / 一の位)
 * としてタンブルさせ、最終出目に着地させる。結果は最初から確定している
 * (rollCoCCheck の値)が、見た目だけアニメーションで“振る”。
 *
 * 着地後は成功度ラベルを色付きで表示し、数秒で自動的に閉じる
 * (クリック / Esc でも閉じられる)。
 */
interface DiceOverlayProps {
  label: string;
  target: number;
  result: CoCCheckResult;
  onClose: () => void;
}

const ROLL_MS = 750;

export function DiceOverlay({
  label,
  target,
  result,
  onClose,
}: DiceOverlayProps) {
  const [phase, setPhase] = useState<"rolling" | "result">("rolling");
  const [faces, setFaces] = useState<[number, number]>([0, 0]);

  // タンブル: 短時間ランダムに目を回し、最後に確定出目へ着地
  useEffect(() => {
    const start = Date.now();
    const iv = window.setInterval(() => {
      if (Date.now() - start >= ROLL_MS) {
        window.clearInterval(iv);
        const roll = result.roll; // 1–100
        // 100 は "00" + "0"(= 100)として表示
        const tens = roll === 100 ? 0 : Math.floor((roll % 100) / 10);
        const ones = roll === 100 ? 0 : roll % 10;
        setFaces([tens, ones]);
        setPhase("result");
        return;
      }
      setFaces([
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 10),
      ]);
    }, 60);
    return () => window.clearInterval(iv);
  }, [result]);

  // 結果表示後に自動クローズ + Esc 対応
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    let t = 0;
    if (phase === "result") t = window.setTimeout(onClose, 2400);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (t) window.clearTimeout(t);
    };
  }, [phase, onClose]);

  const tone = levelTone(result);

  return (
    <div
      className="dice-overlay"
      onClick={onClose}
      role="dialog"
      aria-label="ダイスロール"
    >
      <div className="dice-card" onClick={(e) => e.stopPropagation()}>
        <p className="dice-label">
          {label}
          <span className="dice-target">／ 目標 {target}</span>
        </p>

        <div className={`dice-row ${phase}`}>
          <span className="die" data-place="tens">
            {faces[0]}
          </span>
          <span className="die" data-place="ones">
            {faces[1]}
          </span>
        </div>

        <p className="dice-total">{phase === "result" ? result.roll : "??"}</p>

        {phase === "result" && (
          <p className={`dice-result ${tone}`}>{levelLabel(result)}</p>
        )}

        <p className="dice-hint">クリック / Esc で閉じる</p>
      </div>
    </div>
  );
}

function levelTone(r: CoCCheckResult): string {
  switch (r.level) {
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

function levelLabel(r: CoCCheckResult): string {
  switch (r.level) {
    case "extreme":
      return "イクストリーム成功！";
    case "hard":
      return "ハード成功";
    case "regular":
      return "レギュラー成功";
    case "special":
      return "スペシャル！";
    case "fumble":
      return "ファンブル…";
    default:
      return "失敗";
  }
}
