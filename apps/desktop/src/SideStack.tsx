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
  const dragId = useRef<string | null>(null);
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

  function drop(targetId: string) {
    const src = dragId.current;
    dragId.current = null;
    setOverId(null);
    if (!src || src === targetId) return;
    setState((st) => {
      const ids = ordered.map((s) => s.id).filter((id) => id !== src);
      const at = ids.indexOf(targetId);
      ids.splice(at < 0 ? ids.length : at, 0, src);
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
            className={`ss-sec ${overId === s.id ? "drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOverId(s.id);
            }}
            onDragLeave={() => setOverId((v) => (v === s.id ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              drop(s.id);
            }}
          >
            <div
              className="ss-head"
              draggable
              onDragStart={(e) => {
                dragId.current = s.id;
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                dragId.current = null;
                setOverId(null);
              }}
              onClick={() => toggle(s.id, s.defaultOpen ?? true)}
              title="クリックで開閉 / ドラッグで並べ替え"
            >
              <span className="ss-grip" aria-hidden>
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
