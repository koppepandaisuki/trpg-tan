/**
 * ストアページ専用の背景アンビエント(ダイスの目・きらめき)。
 * サイト全体の `AmbientBackground`(fixed, 全ページ共通, lucide アイコン)
 * とは別に、ストアの白い面(ヒーロー裏・カード間の余白)に低 opacity で
 * 「ダイスの pip」そのものを敷く、より濃いブランド演出
 * (design_handoff_store_redesign 準拠)。
 *
 * 呼び出し側で `position: relative; overflow: hidden;` のコンテナに
 * `absolute inset-0` で重ねて使う。クリック不可(pointer-events: none)。
 */
type Item = {
  top: string;
  left: string;
  kind: "die-c" | "die-g" | "spark" | "star";
  size?: number;
  dur: number;
  delay: number;
  rot: number;
};

const ITEMS: Item[] = [
  { top: "210px", left: "3%", kind: "die-c", dur: 15, delay: 0, rot: -14 },
  { top: "150px", left: "94%", kind: "die-g", size: 38, dur: 18, delay: 1.1, rot: 12 },
  { top: "118px", left: "46%", kind: "spark", dur: 11, delay: 0.4, rot: 0 },
  { top: "760px", left: "6%", kind: "die-g", size: 34, dur: 17, delay: 0.8, rot: 8 },
  { top: "880px", left: "95%", kind: "die-c", size: 52, dur: 16, delay: 2, rot: -10 },
  { top: "1180px", left: "2%", kind: "star", dur: 9, delay: 0.2, rot: 0 },
  { top: "1320px", left: "97%", kind: "spark", dur: 12, delay: 1.6, rot: 0 },
  { top: "1520px", left: "4%", kind: "die-c", size: 42, dur: 19, delay: 0.6, rot: 16 },
  { top: "1720px", left: "92%", kind: "die-g", dur: 14, delay: 1.3, rot: -8 },
  { top: "1640px", left: "49%", kind: "star", dur: 10, delay: 2.4, rot: 0 },
];

const CLASS: Record<Item["kind"], string> = {
  "die-c": "dc-die-c",
  "die-g": "dc-die-g",
  spark: "dc-spark",
  star: "dc-star",
};

export function DiceAmbient() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {ITEMS.map((it, i) => (
        <span
          key={i}
          className={`dc-amb ${CLASS[it.kind]}`}
          style={
            {
              top: it.top,
              left: it.left,
              ...(it.size ? { width: `${it.size}px`, height: `${it.size}px` } : {}),
              "--d": `${it.dur}s`,
              "--delay": `${it.delay}s`,
              "--rot": `${it.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
