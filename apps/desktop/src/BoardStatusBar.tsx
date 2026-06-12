import type { Panel } from "@trpg/core";

/**
 * 盤面左上のコンパクトなステータス一覧(CCFOLIA 風)。
 * 速さ(行動順)の降順で並び、サイドバーと同じ順序を共有する。
 * ターン管理(GM): ▶ で次の手番へ(一巡でラウンド+1)、現在の手番をハイライト。
 */
export function BoardStatusBar({
  cards,
  turn,
  onNextTurn,
  onResetTurn,
}: {
  cards: Panel[];
  /** ターン状態(round 0 = 未開始)。 */
  turn?: { round: number; activePanelId: string | null };
  /** 次の手番へ(GM のみ。未指定でボタン非表示)。 */
  onNextTurn?: () => void;
  /** ターン管理をリセット(GM のみ)。 */
  onResetTurn?: () => void;
}) {
  if (cards.length === 0) return null;
  const started = (turn?.round ?? 0) > 0;

  return (
    <div className="bstatus" aria-label="ステータス(速さ順)">
      {/* ターン操作行(GM) / ラウンド表示(全員) */}
      {(onNextTurn || started) && (
        <div className="bstatus-turnbar">
          {started && <span className="bstatus-round">R{turn!.round}</span>}
          {onNextTurn && (
            <button
              className="btn mini bstatus-next"
              onClick={onNextTurn}
              title={started ? "次の手番へ" : "ターン管理を開始（速さ順）"}
            >
              {started ? "▶ 次の手番" : "▶ ターン開始"}
            </button>
          )}
          {onResetTurn && started && (
            <button
              className="btn mini"
              onClick={onResetTurn}
              title="ターン管理をリセット"
            >
              ⟲
            </button>
          )}
        </div>
      )}

      {cards.map((p) => (
        <div
          key={p.id}
          className={`bstatus-row ${
            started && turn?.activePanelId === p.id ? "active" : ""
          }`}
          title={p.name}
        >
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
