import { useEffect, useRef, useState } from "react";
import type { Panel, PlayBoard as BoardState } from "@trpg/core";

/**
 * 盤面(ココフォリア風)。背景マップ + グリッド + キャラ駒/画像オブジェクト。
 *
 *  - 画像をドラッグ&ドロップ / 「画像を追加」で配置(実寸・比率そのまま)
 *  - 駒はドラッグで移動、右下ハンドルでマウスリサイズ(離した瞬間に確定)
 *  - 駒を右クリック → メニュー(名前 / 情報 / 👁プレイヤー可視 / 削除)
 *  - 画像オブジェクトは名前を出さず、画像そのものを表示
 */

/**
 * 画像そのものを実寸で出す駒か(円形マーカーにしない)。
 * ポートレート(画像)を持つ駒はすべて画像表示にする — キャラシ製のキャラも
 * 追加画像と同じく実寸・比率で表示する。画像が無い駒だけ円形マーカー。
 */
function isImageObject(p: Panel): boolean {
  return !!p.portrait;
}

export function PlayBoard({
  board,
  panels,
  activeSceneId,
  onMove,
  onSetImage,
  onToggleGrid,
  onAddImage,
  onUpdate,
  onRemove,
}: {
  board: BoardState | undefined;
  panels: Panel[];
  /** 現在のシーン id。シーン帰属オブジェクトの表示判定に使う。 */
  activeSceneId?: string;
  onMove: (panelId: string, x: number, y: number) => void;
  onSetImage: (dataUrl: string | null) => void;
  onToggleGrid: () => void;
  onAddImage: (
    name: string,
    dataUrl: string,
    pos: { x: number; y: number },
    size: number,
  ) => void;
  onUpdate: (
    panelId: string,
    patch: Partial<
      Pick<
        Panel,
        "name" | "note" | "hidden" | "size" | "sceneId" | "layer" | "locked"
      >
    >,
  ) => void;
  onRemove: (panelId: string) => void;
}) {
  const grid = board?.grid ?? true;
  const image = board?.image ?? null;
  // このシーンに出すオブジェクト(未帰属=全シーン共通)。layer 昇順 = 後勝ちで前面。
  const visible = panels
    .filter((p) => !p.sceneId || p.sceneId === activeSceneId)
    .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [resize, setResize] = useState<{
    id: string;
    startX: number;
    startY: number;
    startSize: number;
    size: number;
  } | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [menu, setMenu] = useState<{ panelId: string; x: number; y: number } | null>(null);

  const menuPanel = menu ? panels.find((p) => p.id === menu.panelId) ?? null : null;

  function posOf(p: Panel, i: number): { x: number; y: number } {
    if (drag && drag.id === p.id) return { x: drag.x, y: drag.y };
    return p.pos ?? { x: 0.12 + (i % 6) * 0.13, y: 0.16 + Math.floor(i / 6) * 0.2 };
  }
  function sizeOf(p: Panel): number {
    if (resize && resize.id === p.id) return resize.size;
    return p.size ?? (isImageObject(p) ? 140 : 56);
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
    if (e.button !== 0 || p.locked) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const s = posOf(p, i);
    setDrag({ id: p.id, x: s.x, y: s.y });
  }

  function startResize(e: React.PointerEvent, p: Panel) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const s = sizeOf(p);
    setResize({ id: p.id, startX: e.clientX, startY: e.clientY, startSize: s, size: s });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (resize) {
      const d = Math.max(e.clientX - resize.startX, e.clientY - resize.startY);
      const size = Math.max(24, Math.min(1200, Math.round(resize.startSize + d)));
      setResize({ ...resize, size });
      return;
    }
    if (drag) {
      const n = clientToNorm(e.clientX, e.clientY);
      setDrag({ id: drag.id, x: n.x, y: n.y });
    }
  }
  function onPointerUp() {
    if (resize) {
      onUpdate(resize.id, { size: resize.size });
      setResize(null);
      return;
    }
    if (drag) {
      onMove(drag.id, drag.x, drag.y);
      setDrag(null);
    }
  }

  /** 画像ファイルを実寸(幅)で配置。盤面幅の 80% / 700px を上限にクランプ。 */
  function addImageFile(file: File, pos: { x: number; y: number }) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const dataUrl = reader.result;
      const probe = new Image();
      probe.onload = () => {
        const boardW = ref.current?.clientWidth ?? 800;
        const size = Math.min(
          probe.naturalWidth || 160,
          Math.round(boardW * 0.8),
          700,
        );
        onAddImage(stripExt(file.name), dataUrl, pos, size);
      };
      probe.onerror = () => onAddImage(stripExt(file.name), dataUrl, pos, 160);
      probe.src = dataUrl;
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
        <span className="board-hint muted">画像をここにドロップでも追加</span>
      </div>

      <div
        ref={ref}
        className={`board ${dropActive ? "drop-active" : ""}`}
        style={image ? { backgroundImage: `url(${image})` } : undefined}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDragOver={(e) => {
          e.preventDefault();
          setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={onDrop}
      >
        {grid && <div className="board-grid" />}

        {visible.length === 0 && (
          <div className="board-empty muted">
            画像をドロップ、または「画像を追加 / ＋キャラ」で駒を置けます。
            ドラッグで移動、右下のハンドルでサイズ変更、右クリックでメニュー。
          </div>
        )}

        {visible.map((p, i) => {
          const pos = posOf(p, i);
          const size = sizeOf(p);
          const img = isImageObject(p);
          return (
            <div
              key={p.id}
              className={`token ${img ? "img-object" : ""} ${
                drag?.id === p.id ? "dragging" : ""
              } ${p.hidden ? "hidden" : ""} ${p.locked ? "locked" : ""}`}
              style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
              onPointerDown={(e) => startDrag(e, p, i)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ panelId: p.id, x: e.clientX, y: e.clientY });
              }}
              title={p.note ? `${p.name}\n${p.note}` : p.name}
            >
              {img ? (
                <img
                  className="obj-img"
                  src={p.portrait ?? ""}
                  alt=""
                  draggable={false}
                  style={{ width: size }}
                />
              ) : (
                <div
                  className="token-img"
                  style={{
                    width: size,
                    height: size,
                    borderColor: p.color,
                    background: p.color,
                  }}
                >
                  {p.portrait ? (
                    <img src={p.portrait} alt="" draggable={false} />
                  ) : (
                    <span>◆</span>
                  )}
                </div>
              )}

              {p.hidden && <span className="token-eye">🚫</span>}
              {p.locked && <span className="token-pin">📌</span>}
              {!img && <span className="token-name">{p.name}</span>}

              {!p.locked && (
                <span
                  className="token-resize"
                  onPointerDown={(e) => startResize(e, p)}
                  title="ドラッグでサイズ変更"
                />
              )}
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
            activeSceneId={activeSceneId}
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
  activeSceneId,
  onUpdate,
  onDelete,
  onClose,
}: {
  panel: Panel;
  x: number;
  y: number;
  activeSceneId?: string;
  onUpdate: (
    panelId: string,
    patch: Partial<
      Pick<
        Panel,
        "name" | "note" | "hidden" | "size" | "sceneId" | "layer" | "locked"
      >
    >,
  ) => void;
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
    <div className="ctx-menu" style={{ left, top }} onClick={(e) => e.stopPropagation()}>
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

      {/* 位置固定: ドラッグ移動・リサイズを禁止(誤操作防止)。 */}
      <button
        className="ctx-row"
        onClick={() => onUpdate(panel.id, { locked: !panel.locked })}
      >
        <span className="ctx-icon">{panel.locked ? "📌" : "📍"}</span>
        <span>
          {panel.locked
            ? "位置を固定中（クリックで解除）"
            : "位置を固定する（移動・リサイズ禁止）"}
        </span>
      </button>

      {/* シーン引き継ぎ: 未帰属=全シーン共通 / 帰属=このシーン専用。 */}
      <button
        className="ctx-row"
        onClick={() =>
          onUpdate(panel.id, {
            sceneId: panel.sceneId ? null : (activeSceneId ?? null),
          })
        }
        disabled={!activeSceneId && !panel.sceneId}
      >
        <span className="ctx-icon">{panel.sceneId ? "📌" : "🔁"}</span>
        <span>
          {panel.sceneId
            ? "このシーン専用（クリックで引き継ぐ）"
            : "次シーンへ引き継ぐ（クリックでこのシーン専用）"}
        </span>
      </button>

      {/* 重なり順(レイヤー)。 */}
      <div className="ctx-layer">
        <span className="ctx-icon">🗂</span>
        <span>重なり順</span>
        <span style={{ flex: 1 }} />
        <button
          className="btn mini"
          onClick={() => onUpdate(panel.id, { layer: (panel.layer ?? 0) - 1 })}
          title="背面へ"
        >
          ⬇ 背面
        </button>
        <button
          className="btn mini"
          onClick={() => onUpdate(panel.id, { layer: (panel.layer ?? 0) + 1 })}
          title="前面へ"
        >
          ⬆ 前面
        </button>
      </div>

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
