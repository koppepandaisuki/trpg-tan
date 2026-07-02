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
}: {
  storageKey: string;
  sections: SideSection[];
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

  /* ===== 並べ替え(⠿ をポインタドラッグ / ドック中のみ) ===== */

  function startReorder(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    // 各セクションの中点 Y を記録(ドラッグ中はこの座標で挿入先を判定)。
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

  /** ポインタ位置 → 挿入先(この id の前に入れる。"__end__"=末尾)。 */
  function reorderTarget(clientY: number): string {
    const r = reorderRef.current;
    if (!r) return "__end__";
    for (const m of r.mids) {
      if (m.id !== r.id && clientY < m.mid) return m.id;
    }
    return "__end__";
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
    const target = reorderTarget(e.clientY);
    if (target === r.id) return;
    setState((st) => {
      const ids = ordered.map((s) => s.id).filter((id) => id !== r.id);
      const at = target === "__end__" ? ids.length : ids.indexOf(target);
      ids.splice(at < 0 ? ids.length : at, 0, r.id);
      return { ...st, order: ids };
    });
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
              onClick={() => {
                if (!float) toggle(s.id, s.defaultOpen ?? true);
              }}
              onPointerDown={(e) => {
                // フロート中はヘッダドラッグで移動。
                if (float) startMove(e, s.id);
              }}
              onPointerMove={onMoveDrag}
              onPointerUp={endMove}
              title={float ? "ドラッグで移動" : "クリックで開閉"}
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
              <button
                className="ss-float"
                title={float ? "サイドバーに戻す" : "ウィンドウとして切り離す"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFloat(s);
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {float ? "⇤" : "⧉"}
              </button>
            </div>

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
          </section>
        );
      })}
    </div>
  );
}
