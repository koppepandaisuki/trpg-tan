import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * サイドバーの可変スタック。各ブロック(キャラ/テキスト/ログ…)を
 *   - ヘッダの ≡ をドラッグ → 上下の並べ替え
 *   - ブロック下端のバーをドラッグ → 高さ(領域)の指定
 *   - ヘッダクリック → 開閉
 * でき、配置(順序/高さ/開閉)は localStorage に卓ごと保存する。
 */

export interface SideSection {
  id: string;
  title: string;
  icon?: string;
  /** 初期の開閉(既定 true=開)。 */
  defaultOpen?: boolean;
  /** 初期高さ(px)。未指定は内容なり(auto)。 */
  defaultHeight?: number;
  body: ReactNode;
}

interface StackState {
  order: string[];
  heights: Record<string, number>;
  open: Record<string, boolean>;
}

function load(key: string): StackState {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const s = JSON.parse(raw) as StackState;
      if (s && Array.isArray(s.order)) {
        return { order: s.order, heights: s.heights ?? {}, open: s.open ?? {} };
      }
    }
  } catch {
    // 破損時は初期化
  }
  return { order: [], heights: {}, open: {} };
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

  // 卓を切り替えたら読み直し。
  useEffect(() => setState(load(storageKey)), [storageKey]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // 保存失敗は無視(配置は副次的)
    }
  }, [storageKey, state]);

  // 保存済みの順序に従い、未知の id(新ブロック)は定義順で後ろに足す。
  const ordered = [
    ...state.order
      .map((id) => sections.find((s) => s.id === id))
      .filter((s): s is SideSection => !!s),
    ...sections.filter((s) => !state.order.includes(s.id)),
  ];

  function isOpen(s: SideSection): boolean {
    return state.open[s.id] ?? s.defaultOpen ?? true;
  }

  function toggle(id: string, def: boolean) {
    setState((st) => ({
      ...st,
      open: { ...st.open, [id]: !(st.open[id] ?? def) },
    }));
  }

  /* ===== 並べ替え(⠿ をポインタドラッグ) ===== */

  function startReorder(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    // 各セクションの中点 Y を記録(ドラッグ中はこの座標で挿入先を判定)。
    const mids = ordered.map((s) => {
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
    setState((st) => ({ ...st, heights: { ...st.heights, [r.id]: h } }));
  }
  function endResize() {
    resizeRef.current = null;
  }

  return (
    <div className="sstack">
      {ordered.map((s) => {
        const open = isOpen(s);
        const h = state.heights[s.id] ?? s.defaultHeight;
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
            }`}
          >
            <div
              className="ss-head"
              onClick={() => toggle(s.id, s.defaultOpen ?? true)}
              title="クリックで開閉"
            >
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
              <span className="ss-caret" aria-hidden>
                {open ? "▾" : "▸"}
              </span>
              {s.icon && (
                <span className="ss-ic" aria-hidden>
                  {s.icon}
                </span>
              )}
              <span className="ss-title">{s.title}</span>
            </div>

            {/* 閉じてもアンマウントしない(BGM 再生・入力中テキストを保持)。 */}
            <div
              id={`ss-body-${storageKey}-${s.id}`}
              className="ss-body"
              style={{
                ...(h ? { height: h } : {}),
                ...(open ? {} : { display: "none" }),
              }}
            >
              {s.body}
            </div>
            {open && (
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
