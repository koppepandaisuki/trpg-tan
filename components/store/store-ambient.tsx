import type { CSSProperties } from "react";
import { DieFace, type DieFaceNumber } from "./die-face";

/**
 * ストアランディング全面の固定背景アンビエント(Re-dice Store.dc.html)。
 * ビューポート両端に低 opacity のダイス(1〜6 の目)とスパーク/ダイヤを
 * fixed 配置で漂わせる。ヒーロー内限定だった旧 DiceAmbient に代わる
 * ページ全体版。クリック不可・reduced-motion で停止(globals.css の
 * amb-float / amb-twinkle キーフレームを再利用)。
 *
 * 呼び出し側(store ページ)は本文側に position:relative + z-10 を付けて
 * 前面を保つこと。
 */

const CRIMSON = "#B02832";
const GOLD = "#C9A227";
const CHAMPAGNE = "#D9B45C";

const SPARK_CLIP =
  "polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%)";
const DIAMOND_CLIP = "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)";

const DICE: {
  pos: CSSProperties;
  size: number;
  color: string;
  face: DieFaceNumber;
  rot: string;
  dur: number;
  delay: number;
}[] = [
  { pos: { left: "2.5%", top: "16%" }, size: 46, color: CRIMSON, face: 5, rot: "14deg", dur: 16, delay: 0 },
  { pos: { right: "3%", top: "11%" }, size: 38, color: GOLD, face: 4, rot: "-10deg", dur: 18, delay: 1.2 },
  { pos: { left: "4%", top: "58%" }, size: 30, color: CRIMSON, face: 2, rot: "-18deg", dur: 15, delay: 0.6 },
  { pos: { right: "4.5%", top: "64%" }, size: 42, color: GOLD, face: 5, rot: "10deg", dur: 17, delay: 2 },
  { pos: { left: "3%", top: "86%" }, size: 34, color: CRIMSON, face: 3, rot: "8deg", dur: 19, delay: 1.4 },
];

const SHAPES: {
  pos: CSSProperties;
  size: number;
  color: string;
  clip: string;
  dur: number;
  delay: number;
}[] = [
  { pos: { left: "7%", top: "34%" }, size: 18, color: GOLD, clip: SPARK_CLIP, dur: 12, delay: 0 },
  { pos: { right: "8%", top: "38%" }, size: 14, color: GOLD, clip: SPARK_CLIP, dur: 14, delay: 3 },
  { pos: { right: "2.5%", top: "88%" }, size: 16, color: GOLD, clip: SPARK_CLIP, dur: 13, delay: 1.8 },
  { pos: { left: "6%", top: "74%" }, size: 12, color: CHAMPAGNE, clip: DIAMOND_CLIP, dur: 13, delay: 1 },
  { pos: { right: "6.5%", top: "26%" }, size: 10, color: CHAMPAGNE, clip: DIAMOND_CLIP, dur: 15, delay: 2.4 },
];

export function StoreAmbient() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {DICE.map((d, i) => (
        <DieFace
          key={`d${i}`}
          face={d.face}
          size={d.size}
          color={d.color}
          className="dc-amb"
          style={{
            position: "absolute",
            ...d.pos,
            "--rot": d.rot,
            "--d": `${d.dur}s`,
            "--delay": `${d.delay}s`,
          } as CSSProperties}
        />
      ))}
      {SHAPES.map((s, i) => (
        <span
          key={`s${i}`}
          className="dc-amb"
          style={{
            position: "absolute",
            ...s.pos,
            width: s.size,
            height: s.size,
            background: s.color,
            clipPath: s.clip,
            animation: `amb-float ${s.dur}s ease-in-out ${s.delay}s infinite, amb-twinkle ${s.dur / 2}s ease-in-out ${s.delay}s infinite`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
