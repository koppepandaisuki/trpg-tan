import { useEffect, useRef, useState } from "react";
import type { Panel, PlayBoard as BoardState } from "@trpg/core";

/**
 * 盤面(ココフォリア風)。背景マップ + グリッド + キャラ駒/画像オブジェクト。
 *
 *  - 画像をドラッグ&ドロップ、または「画像を追加」で盤面にオブジェクトを置く
 *  - 駒はドラッグで移動(離した瞬間に確定。座標は 0..1 正規化で保存)
 *  - 駒を右クリック → メニュー(名前 / 情報 / 👁プレイヤー可視 / 削除)
 */
export function PlayBoard({
  board,
  panels,
  onMove,
  onSetImage,
  onToggleGrid,
  onAddImage,
  onUpdate,
  onRemove,
}: {
  board: BoardState | undefined;
  panels: Panel[];
  onMove: (panelId: string, x: number, y: number) => void;
  onSetImage: (dataUrl: string | null) => void;
  onToggleGrid: () => void;
  onAddImage: (name: string, dataUrl: string, pos: { x: number; y: number }) => void;
  onUpdate: (panelId: string, patch: Partial<Pick<Panel, "name" | "note" | "hidden">>) => void;
  onRemove: (panelId: string) => void;
}) {
  const grid = board?.grid ?? true;
  const image = board?.image ?? null;
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [menu, setMenu] = useState<{ panelId: string; x: number; y: number } | null>(null);

  const menuPanel = menu ? panels.find((p) => p.id === menu.panelId) ?? null : null;

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
    if (e.button !== 0) return; // 右クリックはドラッグしない
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

  function addImageFile(file: File, pos: { x: number; y: number }) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onAddImage(stripExt(file.name), reader.result, pos);
      }
    };
    reader.readAsDataURL(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropActive(false);
    const file = Array.from(e.dataTransfer.files).find((f) =>
      f.type.startsWith("image/"),
    );
    if (file) addImageFile(file, clientToNorm(e.clientX, e.clientY));
  }

  function pickAddImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) addImageFile(file, { x: 0.5, y: 0.5 });
    e.target.value = "";
  }

  function pickBackground(e: React.ChangeEvent<HTMLInputElement>) {
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
          画像を追加
          <input type="file" accept="image/*" onChange={pickAddImage} style={{ display: "none" }} />
        </label>
        <label className="btn mini board-file">
          背景を設定
          <input type="file" accept="image/*" onChange={pickBackground} style={{ display: "none" }} />
        </label>
        {image && (
          <button className="btn mini" onClick={() => onSetImage(null)}>
            背景クリア
          </button>
        )}
        <button className="btn mini" onClick={onToggleGrid}>
          グリッド: {grid ? "ON" : "OFF"}
        </button>
        <span className="board-hint muted">画像をここにドロップでも追加できます</span>
      </div>

      <div
        ref={ref}
        className={`board ${dropActive ? "drop-active" : ""}`}
        style={image ? { backgroundImage: `url(${image})` } : undefined}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onDragOver={(e) => {
          e.preventDefault();
          setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={onDrop}
      >
        {grid && <div className="board-grid" />}

        {panels.length === 0 && (
          <div className="board-empty muted">
            画像をドロップ、または「画像を追加 / ＋キャラ / ＋トークン」で駒を
            置けます。ドラッグで移動、右クリックでメニュー。
          </div>
        )}

        {panels.map((p, i) => {
          const pos = posOf(p, i);
          return (
            <div
              key={p.id}
              className={`token ${drag?.id === p.id ? "dragging" : ""} ${
                p.hidden ? "hidden" : ""
              }`}
              style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
              onPointerDown={(e) => startDrag(e, p, i)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ panelId: p.id, x: e.clientX, y: e.clientY });
              }}
              title={p.note ? `${p.name}\n${p.note}` : p.name}
            >
              <div className="token-img" style={{ borderColor: p.color, background: p.color }}>
                {p.portrait ? <img src={p.portrait} alt="" /> : <span>◆</span>}
              </div>
              {p.hidden && <span className="token-eye">🚫</span>}
              <span className="token-name">{p.name}</span>
            </div>
          );
        })}
      </div>

      {menu && menuPanel && (
        <>
          <div className="ctx-backdrop" onClick={() => setMenu(null)} />
          <ObjectMenu
            panel={menuPanel}
            x={menu.x}
            y={menu.y}
            onUpdate={onUpdate}
            onDelete={() => {
              onRemove(menuPanel.id);
              setMenu(null);
            }}
            onClose={() => setMenu(null)}
          />
        </>
      )}
    </div>
  );
}

/** 駒の右クリックメニュー。名前/情報は blur で確定、可視は即時、削除あり。 */
function ObjectMenu({
  panel,
  x,
  y,
  onUpdate,
  onDelete,
  onClose,
}: {
  panel: Panel;
  x: number;
  y: number;
  onUpdate: (panelId: string, patch: Partial<Pick<Panel, "name" | "note" | "hidden">>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(panel.name);
  const [note, setNote] = useState(panel.note ?? "");
  const left = Math.min(x, window.innerWidth - 250);
  const top = Math.min(y, window.innerHeight - 280);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="ctx-menu"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="ctx-head">
        {panel.source === "sheet" ? "キャラ駒" : "オブジェクト"}
      </div>

      <label className="ctx-field">
        <span>名前</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const v = name.trim() || panel.name;
            if (v !== panel.name) onUpdate(panel.id, { name: v });
          }}
        />
      </label>

      <label className="ctx-field">
        <span>情報・メモ</span>
        <textarea
          className="input"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== (panel.note ?? "")) onUpdate(panel.id, { note });
          }}
          placeholder="このオブジェクトの情報"
        />
      </label>

      <button
        className="ctx-row"
        onClick={() => onUpdate(panel.id, { hidden: !panel.hidden })}
      >
        <span className="ctx-icon">{panel.hidden ? "🚫" : "👁"}</span>
        <span>
          {panel.hidden
            ? "プレイヤーに秘匿中（クリックで公開）"
            : "プレイヤーに公開中（クリックで秘匿）"}
        </span>
      </button>

      <button className="ctx-row danger" onClick={onDelete}>
        <span className="ctx-icon">🗑</span>
        <span>盤面から削除</span>
      </button>
    </div>
  );
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}
