import type { Panel } from "@trpg/core";

/**
 * 盤面左上のコンパクトなステータス一覧(CCFOLIA 風)。
 * 速さ(行動順)の降順で並び、サイドバーと同じ順序を共有する。
 * 表示専用(操作はサイドバーで)。
 */
export function BoardStatusBar({ cards }: { cards: Panel[] }) {
  if (cards.length === 0) return null;

  return (
    <div className="bstatus" aria-label="ステータス(速さ順)">
      {cards.map((p) => (
        <div key={p.id} className="bstatus-row" title={p.name}>
          <span className="bstatus-speed" title="速さ(行動順)">
            {p.speed ?? "–"}
          </span>
          <span className="bstatus-avatar" style={{ background: p.color }}>
            {p.portrait ? <img src={p.portrait} alt="" /> : <span>👤</span>}
          </span>
          <span className="bstatus-name">{p.name}</span>
          <span className="bstatus-res">
            {p.resources.map((r) => (
              <span key={r.key} className="bstatus-chip">
                <ResIcon k={r.key} />
                <Bar current={r.current} max={r.max} />
                <b>{r.current}</b>
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

function ResIcon({ k }: { k: string }) {
  const key = k.toLowerCase();
  const icon = key === "hp" ? "❤️" : key === "mp" ? "🔷" : key === "san" ? "🧠" : "◆";
  return (
    <span className="bstatus-ic" aria-hidden>
      {icon}
    </span>
  );
}

function Bar({ current, max }: { current: number; max: number }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const tone = ratio <= 0.25 ? "low" : ratio <= 0.5 ? "mid" : "";
  return (
    <span className="bstatus-bar">
      <span className={`bstatus-fill ${tone}`} style={{ width: `${ratio * 100}%` }} />
    </span>
  );
}
