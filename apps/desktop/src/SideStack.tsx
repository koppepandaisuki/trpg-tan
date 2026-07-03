import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * サイドバーの可変スタック。各ブロック(キャラ/テキスト/ログ…)を
 *   - ヘッダの ≡ をドラッグ → 上下の並べ替え
 *   - ブロック下端のバーをドラッグ → 高さ(領域)の指定
 *   - ヘッダクリック → 開閉
 *   - ⧉ ボタン → フロート化(盤面の上に浮くミニウィンドウ。ワンボタンで戻せる)
 * でき、配置(順序/高さ/開閉/フロート)は localStorage に卓ごと保存する。
 *
 * フロートは同じ DOM ノードに position:fixed を当てるだけなので、
 * BGM の再生や入力中のテキストが切り替えで途切れない(アンマウントしない)。
 */

export interface SideSection {
  id: string;
  title: string;
  /** 見出しアイコン(lucide 要素 or 絵文字文字列)。 */
  icon?: ReactNode;
  /** 初期の開閉(既定 true=開)。 */
  defaultOpen?: boolean;
  /** 初期高さ(px)。未指定は内容なり(auto)。 */
  defaultHeight?: number;
  /** アプリ外(OS の別ウィンドウ)へ切り離せるか(onDetach 必須)。 */
  detachable?: boolean;
  /** OS 別ウィンドウで表示中(本体はプレースホルダに差し替わる)。 */
  detached?: boolean;
  body: ReactNode;
}

type FloatPos = { x: number; y: number; w: number; h: number };

interface StackState {
  order: string[];
  heights: Record<string, number>;
  open: Record<string, boolean>;
  /** フロート中のブロック(座標・サイズ)。null/undefined はドック中。 */
  floats?: Record<string, FloatPos | null>;
}

function load(key: string): StackState {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const s = JSON.parse(raw) as StackState;
      if (s && Array.isArray(s.order)) {
        return {
          order: s.order,
          heights: s.heights ?? {},
          open: s.open ?? {},
          floats: s.floats ?? {},
        };
      }
    }
  } catch {
    // 破損時は初期化
  }
  return { order: [], heights: {}, open: {}, floats: {} };
}

/** 画面内に収まるよう座標をクランプ。 */
function clampPos(p: FloatPos): FloatPos {
  const maxX = Math.max(0, window.innerWidth - 80);
  const maxY = Math.max(0, window.innerHeight - 48);
  return {
    ...p,
    x: Math.min(Math.max(0, p.x), maxX),
    y: Math.min(Math.max(0, p.y), maxY),
  };
}

export function SideStack({
  storageKey,
  sections,
  onDetach,
}: {
  storageKey: string;
  sections: SideSection[];
  /** detachable なセクションの「アプリ外へ切り離す / 戻す」トグル。 */
  onDetach?: (id: string) => void;
}) {
  const [state, setState] = useState<StackState>(() => load(storageKey));
  // 並べ替えドラッグ(ポインタ式)。HTML5 DnD は WebView で不安定なので使わない。
  const reorderRef = useRef<{
    id: string;
    mids: { id: string; mid: number }[];
  } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const resizeRef = useRef<{ id: string; startY: number; startH: number } | null>(
    null,
  );
  // フロート移動ドラッグ + 前面順(セッション内のみ。永続不要)。
  const moveRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    orig: FloatPos;
  } | null>(null);
  const [zOrder, setZOrder] = useState<string[]>([]);

  // 卓を切り替えたら読み直し。
  useEffect(() => setState(load(storageKey)), [storageKey]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // 保存失敗は無視(配置は副次的)
    }
  }, [storageKey, state]);

  // 保存済みの順序に従い、未知の id(新ブロック)は定義上の位置へ挿入する
  // (末尾に足すと「一番上に追加」した新機能が既存卓で下に埋もれるため)。
  const ordered = state.order
    .map((id) => sections.find((s) => s.id === id))
    .filter((s): s is SideSection => !!s);
  for (const s of sections) {
    if (!ordered.includes(s)) {
      ordered.splice(Math.min(sections.indexOf(s), ordered.length), 0, s);
    }
  }

  function isOpen(s: SideSection): boolean {
    return state.open[s.id] ?? s.defaultOpen ?? true;
  }

  function floatOf(id: string): FloatPos | null {
    return state.floats?.[id] ?? null;
  }

  function toggle(id: string, def: boolean) {
    setState((st) => ({
      ...st,
      open: { ...st.open, [id]: !(st.open[id] ?? def) },
    }));
  }

  /** ⧉ フロート化 / 戻す。フロート時は必ず開いた状態にする。 */
  function toggleFloat(s: SideSection) {
    setState((st) => {
      const cur = st.floats?.[s.id] ?? null;
      if (cur) {
        return { ...st, floats: { ...st.floats, [s.id]: null } };
      }
      // 初期位置: 画面中央やや右。高さは現在の設定 or 260。
      const w = 340;
      const h = st.heights[s.id] ?? s.defaultHeight ?? 260;
      const pos = clampPos({
        x: Math.max(16, window.innerWidth - w - 380),
        y: 90 + (Object.values(st.floats ?? {}).filter(Boolean).length % 5) * 32,
        w,
        h,
      });
      return {
        ...st,
        open: { ...st.open, [s.id]: true },
        floats: { ...st.floats, [s.id]: pos },
      };
    });
    bringToFront(s.id);
  }

  function bringToFront(id: string) {
    setZOrder((z) => [...z.filter((x) => x !== id), id]);
  }

  /* ===== 並べ替え(ヘッダ or ⠿ をポインタドラッグ / ドック中のみ) ===== */

  /** 並べ替えドラッグを開始する(挿入先判定用に各セクション中点を記録)。 */
  function beginReorder(id: string) {
    // フロート中のものは飛ばす(流れに参加していない)。
    const mids = ordered
      .filter((s) => !floatOf(s.id))
      .map((s) => {
        const el = document.getElementById(`ss-sec-${storageKey}-${s.id}`);
        const r = el?.getBoundingClientRect();
        return { id: s.id, mid: r ? r.top + r.height / 2 : 0 };
      });
    reorderRef.current = { id, mids };
    setDragging(id);
  }

  function startReorder(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    beginReorder(id);
  }

  /** ポインタ位置 → 挿入先(この id の前に入れる。"__end__"=末尾)。 */
  function targetFrom(
    r: { id: string; mids: { id: string; mid: number }[] },
    clientY: number,
  ): string {
    for (const m of r.mids) {
      if (m.id !== r.id && clientY < m.mid) return m.id;
    }
    return "__end__";
  }
  function reorderTarget(clientY: number): string {
    const r = reorderRef.current;
    return r ? targetFrom(r, clientY) : "__end__";
  }

  function onReorderMove(e: React.PointerEvent) {
    if (!reorderRef.current) return;
    setOverId(reorderTarget(e.clientY));
  }

  function endReorder(e: React.PointerEvent) {
    const r = reorderRef.current;
    reorderRef.current = null;
    setDragging(null);
    setOverId(null);
    if (!r) return;
    // 注意: ref を null にした後なので reorderTarget() ではなく r から直接計算する
    // (以前は常に "__end__" 扱いになり「末尾にしか動かせない」バグだった)。
    const target = targetFrom(r, e.clientY);
    if (target === r.id) return;
    setState((st) => {
      const ids = ordered.map((s) => s.id).filter((id) => id !== r.id);
      const at = target === "__end__" ? ids.length : ids.indexOf(target);
      ids.splice(at < 0 ? ids.length : at, 0, r.id);
      return { ...st, order: ids };
    });
  }

  /* ===== ヘッダのポインタ操作 =====
     ドック中: 6px 動かすまではクリック(開閉)、超えたら並べ替えドラッグ。
     フロート中: ドラッグで移動。⠿ グリップ経由の並べ替えも従来どおり使える。 */
  const headDragRef = useRef<{
    id: string;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);

  function onHeadDown(e: React.PointerEvent, s: SideSection) {
    if (floatOf(s.id)) {
      startMove(e, s.id);
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault(); // ドラッグ中のテキスト選択を防ぐ(クリック開閉は up で処理)
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // 合成イベント等でポインタ未登録でも操作自体は続行できる
    }
    headDragRef.current = { id: s.id, x: e.clientX, y: e.clientY, active: false };
  }

  function onHeadMove(e: React.PointerEvent) {
    if (moveRef.current) {
      onMoveDrag(e);
      return;
    }
    const hd = headDragRef.current;
    if (!hd) return;
    if (!hd.active) {
      if (Math.abs(e.clientX - hd.x) + Math.abs(e.clientY - hd.y) < 6) return;
      hd.active = true;
      beginReorder(hd.id);
    }
    setOverId(reorderTarget(e.clientY));
  }

  function onHeadUp(e: React.PointerEvent, s: SideSection) {
    if (moveRef.current) {
      endMove();
      return;
    }
    const hd = headDragRef.current;
    headDragRef.current = null;
    if (hd?.active) {
      endReorder(e);
    } else if (hd && !floatOf(s.id)) {
      toggle(s.id, s.defaultOpen ?? true);
    }
  }

  /* ===== フロート移動(ヘッダをポインタドラッグ) ===== */

  function startMove(e: React.PointerEvent, id: string) {
    const pos = floatOf(id);
    if (!pos || e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    moveRef.current = { id, startX: e.clientX, startY: e.clientY, orig: pos };
    bringToFront(id);
  }
  function onMoveDrag(e: React.PointerEvent) {
    const m = moveRef.current;
    if (!m) return;
    const next = clampPos({
      ...m.orig,
      x: m.orig.x + (e.clientX - m.startX),
      y: m.orig.y + (e.clientY - m.startY),
    });
    setState((st) => ({ ...st, floats: { ...st.floats, [m.id]: next } }));
  }
  function endMove() {
    moveRef.current = null;
  }

  function startResize(e: React.PointerEvent, s: SideSection) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const el = document.getElementById(`ss-body-${storageKey}-${s.id}`);
    resizeRef.current = {
      id: s.id,
      startY: e.clientY,
      startH: el?.clientHeight ?? s.defaultHeight ?? 160,
    };
  }
  function onResizeMove(e: React.PointerEvent) {
    const r = resizeRef.current;
    if (!r) return;
    const h = Math.max(64, Math.min(900, r.startH + (e.clientY - r.startY)));
    setState((st) => {
      const f = st.floats?.[r.id];
      return {
        ...st,
        heights: { ...st.heights, [r.id]: h },
        // フロート中は枠の高さも追従。
        ...(f ? { floats: { ...st.floats, [r.id]: { ...f, h } } } : {}),
      };
    });
  }
  function endResize() {
    resizeRef.current = null;
  }

  return (
    <div className="sstack">
      {ordered.map((s) => {
        const open = isOpen(s);
        const h = state.heights[s.id] ?? s.defaultHeight;
        const float = floatOf(s.id);
        const z = 1200 + Math.max(0, zOrder.indexOf(s.id));
        return (
          <section
            key={s.id}
            id={`ss-sec-${storageKey}-${s.id}`}
            className={`ss-sec ${overId === s.id ? "drag-over" : ""} ${
              dragging === s.id ? "dragging" : ""
            } ${
              overId === "__end__" && ordered[ordered.length - 1]?.id === s.id
                ? "drag-over-end"
                : ""
            } ${float ? "floating" : ""}`}
            style={
              float
                ? {
                    left: float.x,
                    top: float.y,
                    width: float.w,
                    zIndex: z,
                  }
                : undefined
            }
            onPointerDown={float ? () => bringToFront(s.id) : undefined}
          >
            <div
              className="ss-head"
              onPointerDown={(e) => onHeadDown(e, s)}
              onPointerMove={onHeadMove}
              onPointerUp={(e) => onHeadUp(e, s)}
              onPointerCancel={() => {
                headDragRef.current = null;
                reorderRef.current = null;
                setDragging(null);
                setOverId(null);
              }}
              title={
                float ? "ドラッグで移動" : "クリックで開閉 / ドラッグで並べ替え"
              }
            >
              {!float && (
                <span
                  className="ss-grip"
                  aria-hidden
                  onPointerDown={(e) => startReorder(e, s.id)}
                  onPointerMove={onReorderMove}
                  onPointerUp={endReorder}
                  onClick={(e) => e.stopPropagation()}
                  title="ドラッグで並べ替え"
                >
                  ⠿
                </span>
              )}
              {!float && (
                <span className="ss-caret" aria-hidden>
                  {open ? "▾" : "▸"}
                </span>
              )}
              {s.icon && (
                <span className="ss-ic" aria-hidden>
                  {s.icon}
                </span>
              )}
              <span className="ss-title">{s.title}</span>
              {s.detachable && onDetach && (
                <button
                  className="ss-float ss-os"
                  title={
                    s.detached
                      ? "メインウィンドウに戻す"
                      : "アプリ外の別ウィンドウに切り離す(別モニターに置ける)"
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onDetach(s.id);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {s.detached ? "⇤" : "⇗"}
                </button>
              )}
              {!s.detached && (
                <button
                  className="ss-float"
                  title={float ? "サイドバーに戻す" : "盤面の上に浮かせる(アプリ内)"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFloat(s);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {float ? "⇤" : "⧉"}
                </button>
              )}
            </div>

            {/* OS 別ウィンドウ表示中はプレースホルダだけ出す。 */}
            {s.detached ? (
              <div className="ss-body ss-detached-ph">
                <p className="muted">別ウィンドウで表示中</p>
                {onDetach && (
                  <button
                    className="btn mini"
                    onClick={() => onDetach(s.id)}
                  >
                    ⇤ 戻す
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* 閉じてもアンマウントしない(BGM 再生・入力中テキストを保持)。 */}
                <div
                  id={`ss-body-${storageKey}-${s.id}`}
                  className="ss-body"
                  style={{
                    ...(float ? { height: float.h } : h ? { height: h } : {}),
                    ...(open || float ? {} : { display: "none" }),
                  }}
                >
                  {s.body}
                </div>
                {(open || float) && (
                  <div
                    className="ss-resize"
                    onPointerDown={(e) => startResize(e, s)}
                    onPointerMove={onResizeMove}
                    onPointerUp={endResize}
                    title="ドラッグで高さを変更"
                  />
                )}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
