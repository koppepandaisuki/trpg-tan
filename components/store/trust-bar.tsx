/**
 * ヒーロー直下の「信頼シグナル」帯(Re-dice Store.dc.html)。
 * 公開作品数・クリエイター数・平均評価・Stripe 決済を実データで並べる。
 * 平均評価はレビューが 1 件もないときタイルごと出さない(見せかけの
 * 数字を出さない)。
 */
export function TrustBar({
  total,
  creatorCount,
  avgStars,
}: {
  total: number;
  creatorCount: number;
  avgStars: number | null;
}) {
  const items: { num: string; label: string }[] = [
    { num: total.toLocaleString("ja-JP"), label: "公開作品" },
    { num: creatorCount.toLocaleString("ja-JP"), label: "活動クリエイター" },
    ...(avgStars !== null
      ? [{ num: avgStars.toFixed(1), label: "平均評価" }]
      : []),
    { num: "Stripe", label: "安全な決済" },
  ];
  return (
    <div className="mt-5 flex flex-wrap gap-x-9 gap-y-3 border-t border-[#E8DCC5] px-2.5 pt-4">
      {items.map((t) => (
        <div key={t.label} className="flex flex-col">
          <span className="font-serif text-[19px] font-extrabold text-foreground">
            {t.num}
          </span>
          <span className="text-[11px] text-muted-foreground">{t.label}</span>
        </div>
      ))}
    </div>
  );
}
