import { useRef, useState } from "react";
import type { Panel, PlayBoard as BoardState } from "@trpg/core";

/**
 * 盤面。背景マップ(画像) + グリッド + ドラッグで動かせるキャラ駒(トークン)。
 *
 * 座標は 0..1 正規化で保存(盤面サイズに依らない)。ドラッグ中はローカル状態
 * で追従し、離した瞬間に 1 回だけ onMove(確定)を呼ぶ(ログを汚さない)。
 */
export function PlayBoard({
  board,
  panels,
  onMove,
  onSetImage,
  onToggleGrid,
}: {
  board: BoardState | undefined;
  panels: Panel[];
  onMove: (panelId: string, x: number, y: number) => void;
  onSetImage: (dataUrl: string | null) => void;
  onToggleGrid: () => void;
}) {
  const grid = board?.grid ?? true;
  const image = board?.image ?? null;
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );

  function posOf(p: Panel, i: number): { x: number; y: number } {
    if (drag && drag.id === p.id) return { x: drag.x, y: drag.y };
    return p.pos ?? { x: 0.12 + (i % 6) * 0.13, y: 0.16 + Math.floor(i / 6) * 0.2 };
  }

  function clientToNorm(clientX: number, clientY: number) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return { x: 0.5, y: 0.5 };
    return {
      x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
    };
  }

  function startDrag(e: React.PointerEvent, p: Panel, i: number) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const s = posOf(p, i);
    setDrag({ id: p.id, x: s.x, y: s.y });
  }

  function moveDrag(e: React.PointerEvent) {
    if (!drag) return;
    const n = clientToNorm(e.clientX, e.clientY);
    setDrag({ id: drag.id, x: n.x, y: n.y });
  }

  function endDrag() {
    if (!drag) return;
    onMove(drag.id, drag.x, drag.y);
    setDrag(null);
  }

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      onSetImage(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="board-wrap">
      <div className="board-tools">
        <label className="btn mini board-file">
          背景を設定
          <input
            type="file"
            accept="image/*"
            onChange={pickImage}
            style={{ display: "none" }}
          />
        </label>
        {image && (
          <button className="btn mini" onClick={() => onSetImage(null)}>
            背景クリア
          </button>
        )}
        <button className="btn mini" onClick={onToggleGrid}>
          グリッド: {grid ? "ON" : "OFF"}
        </button>
      </div>

      <div
        ref={ref}
        className="board"
        style={image ? { backgroundImage: `url(${image})` } : undefined}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
      >
        {grid && <div className="board-grid" />}

        {panels.length === 0 && (
          <div className="board-empty muted">
            下のパネルで「＋キャラ / ＋トークン」を追加すると、ここに駒が
            置けます。ドラッグで移動できます。
          </div>
        )}

        {panels.map((p, i) => {
          const pos = posOf(p, i);
          return (
            <div
              key={p.id}
              className={`token ${drag?.id === p.id ? "dragging" : ""}`}
              style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
              onPointerDown={(e) => startDrag(e, p, i)}
              title={p.name}
            >
              <div
                className="token-img"
                style={{ borderColor: p.color, background: p.color }}
              >
                {p.portrait ? <img src={p.portrait} alt="" /> : <span>◆</span>}
              </div>
              <span className="token-name">{p.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
