/**
 * スケルトン・ローディング(シマー付きプレースホルダ)。
 * 「読み込み中…」のテキストの代わりに、これから出る UI の骨組みを見せる。
 */

export function SkelCard() {
  return (
    <div className="skel-card">
      <div className="skel skel-cover" />
      <div className="skel skel-line" />
      <div className="skel skel-line short" />
    </div>
  );
}

/** カードのグリッド(ストア一覧 / クリエイター等)。 */
export function SkelGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="skel-grid">
      {Array.from({ length: count }, (_, i) => (
        <SkelCard key={i} />
      ))}
    </div>
  );
}

/** 横スクロール・ストリップ(新着 / 急上昇等)。 */
export function SkelStrip({ count = 5 }: { count?: number }) {
  return (
    <div className="skel-strip">
      {Array.from({ length: count }, (_, i) => (
        <SkelCard key={i} />
      ))}
    </div>
  );
}

/** ストアホームの全体骨組み(バナー + カルーセル + ストリップ×2)。 */
export function SkelStoreHome() {
  return (
    <div className="shome" aria-busy>
      <div className="skel skel-banner" />
      <div className="skel skel-hero" />
      <SkelStrip />
      <SkelStrip />
    </div>
  );
}
