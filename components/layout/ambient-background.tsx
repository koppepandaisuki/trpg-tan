import { Dices, Sparkles, Star } from "lucide-react";

/**
 * サイト全体の背景に敷く、控えめな装飾(サイコロ・キラキラ)。
 * `fixed inset-0 -z-10` で body 背景の上・本文の下に置くため本文の z は触らない。
 * 低不透明度＋ゆっくり浮遊で「うるさくない程度」に留める。PLAY 画面は web に
 * 無い(マーケットのみ)ので全ページ共通で出して問題ない。
 */
type Item = {
  top: string;
  left: string;
  size: number;
  kind: "dice" | "spark" | "star";
  dur: number;
  delay: number;
  rot: number;
};

const ITEMS: Item[] = [
  { top: "9%", left: "4%", size: 60, kind: "dice", dur: 15, delay: 0, rot: -14 },
  { top: "66%", left: "6%", size: 40, kind: "spark", dur: 11, delay: 1.5, rot: 6 },
  { top: "38%", left: "2%", size: 26, kind: "star", dur: 13, delay: 3, rot: 0 },
  { top: "16%", left: "92%", size: 32, kind: "spark", dur: 12, delay: 0.8, rot: 10 },
  { top: "52%", left: "95%", size: 54, kind: "dice", dur: 16, delay: 2.2, rot: 12 },
  { top: "84%", left: "90%", size: 26, kind: "star", dur: 10, delay: 4, rot: 0 },
  { top: "28%", left: "48%", size: 22, kind: "spark", dur: 14, delay: 2.8, rot: 0 },
  { top: "90%", left: "44%", size: 30, kind: "dice", dur: 17, delay: 1, rot: -8 },
  { top: "6%", left: "60%", size: 20, kind: "star", dur: 12, delay: 3.6, rot: 0 },
  { top: "74%", left: "70%", size: 26, kind: "spark", dur: 13, delay: 0.4, rot: 0 },
];

const ICON = { dice: Dices, spark: Sparkles, star: Star } as const;

export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {ITEMS.map((it, i) => {
        const Icon = ICON[it.kind];
        return (
          <span
            key={i}
            className={`amb-item amb-${it.kind}`}
            style={
              {
                top: it.top,
                left: it.left,
                "--d": `${it.dur}s`,
                "--delay": `${it.delay}s`,
                "--rot": `${it.rot}deg`,
              } as React.CSSProperties
            }
          >
            <Icon size={it.size} strokeWidth={1.5} />
          </span>
        );
      })}
    </div>
  );
}
