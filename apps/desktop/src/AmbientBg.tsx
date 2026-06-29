import { Dices, Sparkles, Star } from "lucide-react";

/**
 * 背景のさみしさを埋める、控えめな装飾レイヤー(サイコロ・キラキラ)。
 * PLAY 卓の上には出さない(App.tsx の通常シェルにだけ敷き、PLAY レイヤが
 * 前面を覆う)。低不透明度＋ゆっくり浮遊で「うるさくない程度」に留める。
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
  { top: "10%", left: "5%", size: 56, kind: "dice", dur: 15, delay: 0, rot: -14 },
  { top: "70%", left: "8%", size: 38, kind: "spark", dur: 11, delay: 1.5, rot: 6 },
  { top: "40%", left: "3%", size: 26, kind: "star", dur: 13, delay: 3, rot: 0 },
  { top: "18%", left: "90%", size: 30, kind: "spark", dur: 12, delay: 0.8, rot: 10 },
  { top: "55%", left: "94%", size: 50, kind: "dice", dur: 16, delay: 2.2, rot: 12 },
  { top: "85%", left: "88%", size: 24, kind: "star", dur: 10, delay: 4, rot: 0 },
  { top: "32%", left: "46%", size: 22, kind: "spark", dur: 14, delay: 2.8, rot: 0 },
  { top: "88%", left: "40%", size: 30, kind: "dice", dur: 17, delay: 1, rot: -8 },
  { top: "8%", left: "62%", size: 20, kind: "star", dur: 12, delay: 3.6, rot: 0 },
  { top: "62%", left: "66%", size: 26, kind: "spark", dur: 13, delay: 0.4, rot: 0 },
];

const ICON = { dice: Dices, spark: Sparkles, star: Star } as const;

export function AmbientBg() {
  return (
    <div className="ambient-bg" aria-hidden>
      {ITEMS.map((it, i) => {
        const Icon = ICON[it.kind];
        return (
          <span
            key={i}
            className={`ambient-item ai-${it.kind}`}
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
