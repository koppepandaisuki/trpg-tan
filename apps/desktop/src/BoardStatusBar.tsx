import { useEffect, useRef, useState } from "react";
import {
  Heart,
  Droplet,
  Brain,
  Diamond,
  Play,
  RotateCcw,
  GripVertical,
} from "lucide-react";
import type { Panel } from "@trpg/core";

const POS_KEY = "trpg.bstatus.pos.v1";

function loadPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { x: number; y: number };
      if (typeof p.x === "number" && typeof p.y === "number") return p;
    }
  } catch {
    /* 位置の読み出し失敗は既定値で */
  }
  return { x: 22, y: 54 }; // 既定: 左上
}

/**
 * 盤面に浮くコンパクトなステータス一覧(CCFOLIA 風)。固定ではなく、左上のグリップ
 * (⠿)を掴んで好きな場所へドラッグできる(位置は端末に保存)。
 * 速さ(行動順)の降順で並び、ターン管理(GM)も兼ねる。
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
  const [pos, setPos] = useState(loadPos);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // 位置が変わったら端末に保存(ドラッグ中の連続更新はまとめる)。
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos));
      } catch {
        /* 保存失敗は無視 */
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [pos]);

  // 盤面内に収まるよう座標をクランプ(画面/盤面が小さくても はみ出さない)。
  function clampToParent(x: number, y: number): { x: number; y: number } {
    const parent = ref.current?.parentElement;
    const bar = ref.current;
    if (!parent || !bar) return { x, y };
    const maxX = Math.max(4, parent.clientWidth - bar.offsetWidth - 4);
    const maxY = Math.max(4, parent.clientHeight - bar.offsetHeight - 4);
    return { x: Math.max(4, Math.min(x, maxX)), y: Math.max(4, Math.min(y, maxY)) };
  }

  // 初期表示・ウィンドウリサイズ・行数変化のたびに、画面外なら盤面内へ戻す。
  // 保存済みの位置が今の画面では画面外、というケース(小さい画面)を救う。
  useEffect(() => {
    const reclamp = () =>
      setPos((p) => {
        const c = clampToParent(p.x, p.y);
        return c.x === p.x && c.y === p.y ? p : c;
      });
    reclamp();
    window.addEventListener("resize", reclamp);
    return () => window.removeEventListener("resize", reclamp);
    // 行数(=高さ)が変わるときも再クランプ。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length]);

  if (cards.length === 0) return null;
  const started = (turn?.round ?? 0) > 0;

  function onGripDown(e: React.PointerEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  }
  function onGripMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setPos(clampToParent(e.clientX - drag.current.dx, e.clientY - drag.current.dy));
  }
  function onGripUp() {
    drag.current = null;
  }

  return (
    <div
      ref={ref}
      className="bstatus"
      style={{ left: pos.x, top: pos.y }}
      aria-label="ステータス(速さ順)"
    >
      {/* ドラッグ用グリップ(これだけ掴んで移動)。 */}
      <div
        className="bstatus-grip"
        onPointerDown={onGripDown}
        onPointerMove={onGripMove}
        onPointerUp={onGripUp}
        title="ドラッグで移動"
        aria-label="ステータスバーを移動"
      >
        <GripVertical size={12} />
      </div>

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
              <Play size={12} /> {started ? "次の手番" : "ターン開始"}
            </button>
          )}
          {onResetTurn && started && (
            <button
              className="btn mini"
              onClick={onResetTurn}
              title="ターン管理をリセット"
            >
              <RotateCcw size={12} />
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
  const icon =
    key === "hp" ? (
      <Heart size={11} className="res-hp" />
    ) : key === "mp" ? (
      <Droplet size={11} className="res-mp" />
    ) : key === "san" ? (
      <Brain size={11} className="res-san" />
    ) : (
      <Diamond size={11} className="res-etc" />
    );
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
