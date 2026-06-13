import type { ReactNode } from "react";

/**
 * 空状態(コンテンツ 0 件)の標準表示。テキストだけの「ありません」を
 * やめ、ブランドのサイコロ・イラスト + 見出し + 次の行動(CTA)を出す。
 */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  /** 次の行動(任意)。 */
  action?: { label: ReactNode; onClick: () => void };
}) {
  return (
    <div className="empty">
      <svg
        className="empty-art"
        viewBox="0 0 96 96"
        fill="none"
        aria-hidden
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ブランドのサイコロ(線画) + きらめき */}
        <rect
          x="22"
          y="30"
          width="44"
          height="44"
          rx="10"
          stroke="currentColor"
          strokeWidth="3.5"
        />
        <circle cx="36" cy="44" r="3.6" fill="currentColor" />
        <circle cx="52" cy="60" r="3.6" fill="currentColor" />
        <circle cx="44" cy="52" r="3.6" fill="currentColor" />
        <path
          d="M74 18l2.2 5.8L82 26l-5.8 2.2L74 34l-2.2-5.8L66 26l5.8-2.2L74 18z"
          fill="currentColor"
          opacity="0.55"
        />
        <path
          d="M16 14l1.5 3.8L21.5 19l-3.8 1.5L16 24l-1.5-3.5L10.5 19l4-1.2L16 14z"
          fill="currentColor"
          opacity="0.35"
        />
      </svg>
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint muted">{hint}</p>}
      {action && (
        <button className="btn btn-primary ibtn" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
