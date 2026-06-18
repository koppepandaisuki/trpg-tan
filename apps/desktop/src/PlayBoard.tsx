import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Panel, PlayBoard as BoardState } from "@trpg/core";
import { Eye, EyeOff, Pin, Repeat, Layers, Trash2, Ruler } from "lucide-react";
import { ASSET_MIME } from "./AssetsPanel";

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

/**
 * 仮想ステージの固定サイズ(16:9)。盤面は常にこの座標系で描き、
 * 利用可能な領域に合わせて均一スケールで縮小/拡大して表示する。
 * → GM ビューはプレイヤービューの「縮小版」になり、どの画面サイズでも
 *   全員がまったく同じ構図を見る(背景の見切れ問題の根治)。
 */
const STAGE_W = 1280;
const STAGE_H = 720;

export function PlayBoard({
  board,
  panels,
  activeSceneId,
  playerMode = false,
  onMove,
  onSetImage,
  onSetForeground,
  onToggleGrid,
  onAddImage,
  onUpdate,
  onRemove,
}: {
  board: BoardState | undefined;
  panels: Panel[];
  /** 現在のシーン id。シーン帰属オブジェクトの表示判定に使う。 */
  activeSceneId?: string;
  /** 参加者ビュー(GM ツール/秘匿駒/右クリック/リサイズを隠す)。 */
  playerMode?: boolean;
  onMove: (panelId: string, x: number, y: number) => void;
  onSetImage: (dataUrl: string | null) => void;
  /** 前景画像(駒より上のレイヤー)の設定 / 解除。GM のみ。 */
  onSetForeground?: (dataUrl: string | null) => void;
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
        | "name"
        | "note"
        | "hidden"
        | "size"
        | "height"
        | "sceneId"
        | "layer"
        | "locked"
        | "portrait"
        | "variants"
      >
    >,
  ) => void;
  onRemove: (panelId: string) => void;
}) {
  const grid = board?.grid ?? true;
  const image = board?.image ?? null;
  const foreground = board?.foreground ?? null;
  // このシーンに出すオブジェクト(未帰属=全シーン共通)。layer 昇順 = 後勝ちで前面。
  // 非表示(hidden): キャラ駒は GM・参加者とも盤面から消す(単純な表示/非表示。
  // GM はキャラ一覧の目アイコンで戻せる)。画像オブジェクトは一覧に無いので、GM
  // だけ薄く盤面に残して戻せるようにする(参加者には出さない)。
  const visible = panels
    .filter((p) => !p.sceneId || p.sceneId === activeSceneId)
    .filter((p) => !p.hidden || (!playerMode && isImageObject(p)))
    .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));
  const ref = useRef<HTMLDivElement>(null);
  // 仮想ステージのスケール(利用可能領域にフィット)。
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // ズーム/パン(この画面だけのローカル表示。他の参加者には影響しない)。
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef<{ sx: number; sy: number; bx: number; by: number } | null>(
    null,
  );
  const effScale = scale * zoom;

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function onWheel(e: React.WheelEvent) {
    const next = Math.max(
      1,
      Math.min(4, zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)),
    );
    setZoom(next);
    if (next === 1) setPan({ x: 0, y: 0 });
  }
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setScale(Math.min(r.width / STAGE_W, r.height / STAGE_H));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [resize, setResize] = useState<{
    id: string;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    w: number;
    h: number;
    /** 画像オブジェクト(縦横を独立に伸縮できる)。円形駒は常に正方。 */
    img: boolean;
  } | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [menu, setMenu] = useState<{ panelId: string; x: number; y: number } | null>(null);
  // グリッド吸着(40px セル中心へスナップ)。設定は端末に保存。
  const [snap, setSnap] = useState(
    () => localStorage.getItem("trpg.board.snap.v1") !== "0",
  );
  function toggleSnap() {
    setSnap((v) => {
      localStorage.setItem("trpg.board.snap.v1", v ? "0" : "1");
      return !v;
    });
  }

  const menuPanel = menu ? panels.find((p) => p.id === menu.panelId) ?? null : null;

  function posOf(p: Panel, i: number): { x: number; y: number } {
    if (drag && drag.id === p.id) return { x: drag.x, y: drag.y };
    return p.pos ?? { x: 0.12 + (i % 6) * 0.13, y: 0.16 + Math.floor(i / 6) * 0.2 };
  }
  function sizeOf(p: Panel): number {
    if (resize && resize.id === p.id) return resize.w;
    return p.size ?? (isImageObject(p) ? 140 : 56);
  }
  /** 画像の高さ(px)。リサイズ中はその値、未指定なら undefined(縦横比で自動)。 */
  function heightOf(p: Panel): number | undefined {
    if (resize && resize.id === p.id) return resize.h;
    return p.height;
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
    e.stopPropagation(); // 背景パンを起動しない
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const s = posOf(p, i);
    setDrag({ id: p.id, x: s.x, y: s.y });
  }

  /** 盤面の背景ドラッグでパン(ズーム中のみ。駒の上では発火しない)。 */
  function startPan(e: React.PointerEvent) {
    if (e.button !== 0 || zoom <= 1) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panRef.current = { sx: e.clientX, sy: e.clientY, bx: pan.x, by: pan.y };
  }

  function startResize(e: React.PointerEvent, p: Panel) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const img = isImageObject(p);
    const w = sizeOf(p);
    let h = p.height ?? 0;
    if (img && !h) {
      // 高さ未設定の画像は、表示中の img の自然比から現在の高さ(ステージpx)を割り出す。
      const el = (e.currentTarget as HTMLElement)
        .closest(".token")
        ?.querySelector("img");
      if (el && el.naturalWidth) {
        h = Math.round((w * el.naturalHeight) / el.naturalWidth);
      }
    }
    if (!h) h = w; // 円形駒(正方)など
    setResize({
      id: p.id,
      startX: e.clientX,
      startY: e.clientY,
      startW: w,
      startH: h,
      w,
      h,
      img,
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (panRef.current) {
      const p = panRef.current;
      const limit = STAGE_W * effScale;
      setPan({
        x: Math.max(-limit, Math.min(limit, p.bx + (e.clientX - p.sx))),
        y: Math.max(-limit, Math.min(limit, p.by + (e.clientY - p.sy))),
      });
      return;
    }
    if (resize) {
      // 画面ピクセル → 仮想ステージ座標(スケールで割る)。
      const dx = (e.clientX - resize.startX) / (effScale || 1);
      const dy = (e.clientY - resize.startY) / (effScale || 1);
      const clamp = (v: number) => Math.max(24, Math.min(2400, Math.round(v)));
      if (resize.img && !e.shiftKey) {
        // 画像は縦横を独立に伸縮(自由変形)。Shift で等倍。
        setResize({ ...resize, w: clamp(resize.startW + dx), h: clamp(resize.startH + dy) });
      } else {
        // 等倍: 幅の変化に合わせて高さも比率維持。
        const w = clamp(resize.startW + Math.max(dx, dy));
        const h = clamp(resize.startH * (w / resize.startW));
        setResize({ ...resize, w, h });
      }
      return;
    }
    if (drag) {
      const n = clientToNorm(e.clientX, e.clientY);
      setDrag({ id: drag.id, x: n.x, y: n.y });
    }
  }
  function onPointerUp() {
    if (panRef.current) {
      panRef.current = null;
      return;
    }
    if (resize) {
      // 画像は幅+高さを保存(自由変形)。円形駒は幅(=直径)のみ。
      onUpdate(
        resize.id,
        resize.img ? { size: resize.w, height: resize.h } : { size: resize.w },
      );
      setResize(null);
      return;
    }
    if (drag) {
      let { x, y } = drag;
      // 吸着: 仮想ステージ上の 40px グリッドのセル中心へスナップ。
      if (snap && grid) {
        const sx = Math.floor((x * STAGE_W) / 40) * 40 + 20;
        const sy = Math.floor((y * STAGE_H) / 40) * 40 + 20;
        x = Math.max(0, Math.min(1, sx / STAGE_W));
        y = Math.max(0, Math.min(1, sy / STAGE_H));
      }
      onMove(drag.id, x, y);
      setDrag(null);
    }
  }

  /** data URL を実寸(幅)で配置。盤面幅の 80% / 700px を上限にクランプ。 */
  function addImageDataUrl(
    name: string,
    dataUrl: string,
    pos: { x: number; y: number },
  ) {
    const probe = new Image();
    probe.onload = () => {
      const size = Math.min(
        probe.naturalWidth || 160,
        Math.round(STAGE_W * 0.8),
        700,
      );
      onAddImage(name, dataUrl, pos, size);
    };
    probe.onerror = () => onAddImage(name, dataUrl, pos, 160);
    probe.src = dataUrl;
  }

  /** 画像ファイルを読み込んで配置。 */
  function addImageFile(file: File, pos: { x: number; y: number }) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      addImageDataUrl(stripExt(file.name), reader.result, pos);
    };
    reader.readAsDataURL(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDropActive(false);
    const pos = clientToNorm(e.clientX, e.clientY);
    // アセット(素材庫)からのドラッグ。
    const assetJson = e.dataTransfer.getData(ASSET_MIME);
    if (assetJson) {
      try {
        const a = JSON.parse(assetJson) as { name: string; image: string };
        if (a.image) addImageDataUrl(a.name || "アセット", a.image, pos);
        return;
      } catch {
        // 壊れたデータは無視してファイル処理へ
      }
    }
    const file = Array.from(e.dataTransfer.files).find((f) =>
      f.type.startsWith("image/"),
    );
    if (file) addImageFile(file, pos);
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
  function pickForeground(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onSetForeground) return;
    const reader = new FileReader();
    reader.onload = () =>
      onSetForeground(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="board-wrap">
      {!playerMode && (
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
        {onSetForeground && (
          <label className="btn mini board-file">
            前景を設定
            <input
              type="file"
              accept="image/*"
              onChange={pickForeground}
              style={{ display: "none" }}
            />
          </label>
        )}
        {onSetForeground && foreground && (
          <button className="btn mini" onClick={() => onSetForeground(null)}>
            前景クリア
          </button>
        )}
        <button className="btn mini" onClick={onToggleGrid}>
          グリッド: {grid ? "ON" : "OFF"}
        </button>
        {grid && (
          <button
            className="btn mini"
            onClick={toggleSnap}
            title="駒をグリッドのマス目に吸着させる"
          >
            吸着: {snap ? "ON" : "OFF"}
          </button>
        )}
      </div>
      )}

      {/* 仮想ステージ(1280x720 固定)を領域にフィットさせて表示。
          GM もプレイヤーも同じ構図(縮尺だけ違う)を見る。 */}
      <div
        ref={viewportRef}
        className={`board-viewport ${dropActive ? "drop-active" : ""}`}
        onWheel={onWheel}
        onDragOver={(e) => {
          e.preventDefault();
          setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={onDrop}
      >
        {/* ズーム表示 / フィットに戻す(ローカル表示のみ)。 */}
        {zoom > 1 && (
          <button
            className="board-zoom-badge"
            onClick={resetView}
            title="全体表示に戻す（ホイールでズーム / ドラッグでパン）"
          >
            ⊡ {Math.round(zoom * 100)}%
          </button>
        )}
        <div
          className="board-scalebox"
          style={{
            width: STAGE_W * effScale,
            height: STAGE_H * effScale,
            transform: `translate(${pan.x}px, ${pan.y}px)`,
          }}
        >
      <div
        ref={ref}
        className={`board ${zoom > 1 ? "pannable" : ""}`}
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${effScale})`,
          transformOrigin: "top left",
          ...(image ? { backgroundImage: `url(${image})` } : {}),
        }}
        onPointerDown={startPan}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {grid && <div className="board-grid" />}

        {visible.length === 0 && !image && (
          <div className="board-empty muted">
            画像をドロップ、または「画像を追加 / ＋キャラ」で駒を置けます。
            ドラッグで移動、右下のハンドルでサイズ変更、右クリックでメニュー。
          </div>
        )}

        {visible.map((p, i) => {
          const pos = posOf(p, i);
          const size = sizeOf(p);
          const h = heightOf(p);
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
                // 参加者はキャラ駒(ステータスを持つ駒)のみメニューを開ける。
                const isChar = p.stats.length > 0 || p.resources.length > 0;
                if (!playerMode || isChar) {
                  setMenu({ panelId: p.id, x: e.clientX, y: e.clientY });
                }
              }}
              title={p.note ? `${p.name}\n${p.note}` : p.name}
            >
              {img ? (
                <img
                  className="obj-img"
                  src={p.portrait ?? ""}
                  alt=""
                  draggable={false}
                  style={
                    h
                      ? { width: size, height: h, objectFit: "fill" }
                      : { width: size }
                  }
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

              {!playerMode && img ? (
                // 画像オブジェクト: ワンクリックで表示/非表示(位置・大きさは保持)。
                <button
                  className={`token-eyebtn ${p.hidden ? "off" : ""}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate(p.id, { hidden: !p.hidden });
                  }}
                  title={
                    p.hidden
                      ? "非表示中（クリックで表示）"
                      : "クリックで非表示にする（位置・大きさは保持）"
                  }
                >
                  {p.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              ) : (
                p.hidden && (
                  <span className="token-eye">
                    <EyeOff size={12} />
                  </span>
                )
              )}
              {p.locked && (<span className="token-pin"><Pin size={12} /></span>)}
              {!img && <span className="token-name">{p.name}</span>}

              {!p.locked && !playerMode && (
                <span
                  className="token-resize"
                  onPointerDown={(e) => startResize(e, p)}
                  title="ドラッグでサイズ変更"
                />
              )}
            </div>
          );
        })}

        {/* 前景レイヤー: 駒より上に重ねる演出画像。操作は透過させる。 */}
        {foreground && (
          <img
            className="board-foreground"
            src={foreground}
            alt=""
            draggable={false}
          />
        )}
      </div>
        </div>
      </div>

      {menu && menuPanel && (
        <>
          <div className="ctx-backdrop" onClick={() => setMenu(null)} />
          <ObjectMenu
            panel={menuPanel}
            x={menu.x}
            y={menu.y}
            activeSceneId={activeSceneId}
            playerMode={playerMode}
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
  playerMode = false,
  onUpdate,
  onDelete,
  onClose,
}: {
  panel: Panel;
  x: number;
  y: number;
  activeSceneId?: string;
  /** 参加者ビュー: 名前とメモと差分だけ(GM 専用の行は隠す)。 */
  playerMode?: boolean;
  onUpdate: (
    panelId: string,
    patch: Partial<
      Pick<
        Panel,
        | "name"
        | "note"
        | "hidden"
        | "size"
        | "height"
        | "sceneId"
        | "layer"
        | "locked"
        | "portrait"
        | "variants"
      >
    >,
  ) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(panel.name);
  const [note, setNote] = useState(panel.note ?? "");
  // 差分追加用のラベル入力。
  const [vLabel, setVLabel] = useState("");
  // サイズ(右下ハンドルに触れない巨大画像向けの代替手段)。確定時のみ反映。
  const [size, setSize] = useState(
    panel.size ?? (panel.portrait ? 140 : 56),
  );
  function commitSize(v: number) {
    const s = Math.max(24, Math.min(4000, Math.round(v) || 24));
    setSize(s);
    if (s !== panel.size) onUpdate(panel.id, { size: s });
  }
  const isChar = panel.stats.length > 0 || panel.resources.length > 0;

  /** 差分画像を追加。初回は現在の立ち絵を「基本」として自動登録する。 */
  function addVariant(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const base =
        panel.variants ??
        (panel.portrait
          ? [{ id: crypto.randomUUID(), label: "基本", image: panel.portrait }]
          : []);
      const label =
        vLabel.trim() || file.name.replace(/\.[^.]+$/, "") || `差分${base.length + 1}`;
      onUpdate(panel.id, {
        variants: [
          ...base,
          { id: crypto.randomUUID(), label, image: reader.result },
        ],
      });
      setVLabel("");
    };
    reader.readAsDataURL(file);
  }
  // メニュー実寸を測ってから画面内に収める(画面下/右の駒でも埋もれない)。
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - el.offsetWidth - 10)),
      top: Math.max(8, Math.min(y, window.innerHeight - el.offsetHeight - 10)),
    });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="ctx-menu"
      style={{ left: pos.left, top: pos.top }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="ctx-head">
        {panel.source === "sheet" ? "キャラ駒" : "オブジェクト"}
        {!playerMode && (
          <button
            className={`ctx-lock ${panel.locked ? "on" : ""}`}
            onClick={() => onUpdate(panel.id, { locked: !panel.locked })}
            title={
              panel.locked
                ? "位置を固定中（クリックで解除）"
                : "位置を固定する（移動・リサイズ禁止）"
            }
            aria-pressed={!!panel.locked}
          >
            {panel.locked ? "🔒" : "🔓"}
          </button>
        )}
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

      {/* 差分(立ち絵/表情の切替)。キャラ駒のみ。参加者も使える。 */}
      {isChar && (
        <div className="ctx-variants">
          <div className="ctx-vhead">
            差分 <span className="muted">（ダブルクリックで切替）</span>
          </div>
          {(panel.variants ?? []).length > 0 && (
            <div className="ctx-vlist">
              {(panel.variants ?? []).map((v) => (
                <div
                  key={v.id}
                  className={`ctx-vchip ${panel.portrait === v.image ? "active" : ""}`}
                  onDoubleClick={() => onUpdate(panel.id, { portrait: v.image })}
                  title={`「${v.label}」 — ダブルクリックで切替 / チャットで @${v.label}`}
                >
                  <img src={v.image} alt="" draggable={false} />
                  <span className="ctx-vlabel">{v.label}</span>
                  <button
                    className="ctx-vdel"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdate(panel.id, {
                        variants: (panel.variants ?? []).filter(
                          (x) => x.id !== v.id,
                        ),
                      });
                    }}
                    title="この差分を削除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="ctx-vadd">
            <input
              className="input"
              value={vLabel}
              onChange={(e) => setVLabel(e.target.value)}
              placeholder="ラベル（例: 笑顔）"
              maxLength={20}
            />
            <label className="btn mini board-file">
              ＋画像
              <input
                type="file"
                accept="image/*"
                onChange={addVariant}
                style={{ display: "none" }}
              />
            </label>
          </div>
        </div>
      )}

      {/* ここから下は GM 専用(参加者は名前とメモのみ)。 */}
      {!playerMode && (
        <>
      <button
        className="ctx-row"
        onClick={() => onUpdate(panel.id, { hidden: !panel.hidden })}
      >
        <span className="ctx-icon">{panel.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</span>
        <span>
          {panel.hidden
            ? "プレイヤーに秘匿中（クリックで公開）"
            : "プレイヤーに公開中（クリックで秘匿）"}
        </span>
      </button>

      {/* サイズ変更: 大きい画像でハンドルに触れないときの代替手段。 */}
      <div className="ctx-layer">
        <span className="ctx-icon"><Ruler size={14} /></span>
        <span>サイズ</span>
        <input
          className="ctx-size-range"
          type="range"
          min={24}
          max={1600}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          onPointerUp={() => commitSize(size)}
          title="ドラッグでサイズ変更（離すと確定）"
        />
        <input
          className="input ctx-size-num"
          type="number"
          min={24}
          max={4000}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          onBlur={() => commitSize(size)}
          onKeyDown={(e) => e.key === "Enter" && commitSize(size)}
          title="px 指定"
        />
      </div>

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
        <span className="ctx-icon">{panel.sceneId ? <Pin size={14} /> : <Repeat size={14} />}</span>
        <span>
          {panel.sceneId
            ? "このシーン専用（クリックで引き継ぐ）"
            : "次シーンへ引き継ぐ（クリックでこのシーン専用）"}
        </span>
      </button>

      {/* 重なり順(レイヤー)。 */}
      <div className="ctx-layer">
        <span className="ctx-icon"><Layers size={14} /></span>
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
        <span className="ctx-icon"><Trash2 size={14} /></span>
        <span>盤面から削除</span>
      </button>
        </>
      )}
    </div>
  );
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}
