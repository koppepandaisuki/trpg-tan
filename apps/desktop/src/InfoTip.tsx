/**
 * 初心者向けのヒント・バッジ。? にカーソル(またはフォーカス)を乗せると
 * 説明が浮き上がる。改行(\n)はそのまま改行表示する。
 */
export function InfoTip({
  text,
  compact,
}: {
  text: string;
  compact?: boolean;
}) {
  return (
    <span
      className={`infotip ${compact ? "compact" : ""}`}
      tabIndex={0}
      role="note"
      aria-label={text}
    >
      <span className="infotip-badge" aria-hidden>
        ?
      </span>
      <span className="infotip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
